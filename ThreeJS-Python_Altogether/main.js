import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.120.1/examples/jsm/loaders/STLLoader.js';

//vertex shader that passes normals
const _VS = `

varying vec3 v_NormalInterp;
varying vec3 v_VertPos;

void main() {
	vec4 vertPos4 = modelViewMatrix * vec4(position, 1.0);
	v_VertPos = vec3(vertPos4) / vertPos4.w;
	v_NormalInterp = normalMatrix * normal;
	gl_Position = projectionMatrix * vertPos4;
}
`;

//vertex shader for Cel Shading + contour line drawing that just passes Phong-interpolated normals and the light position and target in view space
const _AnimeVS = `

uniform vec3 light_pos;
uniform vec3 light_target;

varying vec3 v_ViewLightPosition;
varying vec3 v_ViewLightTargetPosition;

varying vec3 v_NormalInterp;
varying vec3 v_VertPos;


void main() {
	vec4 vertPos4 = modelViewMatrix * vec4(position, 1.0);
	v_VertPos = vec3(vertPos4) / vertPos4.w;
	v_NormalInterp = normalMatrix * normal;
	gl_Position = projectionMatrix * vertPos4;

	vec4 light_target_mv = viewMatrix * vec4(light_target, 1.0);
	vec4 light_pos_mv = viewMatrix * vec4(light_pos, 1.0);
	v_ViewLightPosition = - light_pos_mv.xyz;
	v_ViewLightTargetPosition = - light_target_mv.xyz;
}
`;

//fragment shader that displays Phong interpolated normals
const _NormalFS = `

varying vec3 v_NormalInterp;

void main() {
	vec3 scaled = normalize(v_NormalInterp) * 0.5 + vec3(0.5);
	gl_FragColor = vec4(scaled, 1.0);
}
`;

//fragment shader that displays view vectors
const _ViewerFS = `

varying vec3 v_VertPos;

void main() {
	vec3 scaled = -normalize(v_VertPos) * 0.5 + vec3(0.5);
	gl_FragColor = vec4(scaled, 1.0);
}
`;

//fragment shader that displays the view vector's projection onto the tangent plane (or w)
const _WFS = `

varying vec3 v_NormalInterp;
varying vec3 v_VertPos;

void main() {
	vec3 normal = normalize(v_NormalInterp);
	vec3 viewer = normalize(-v_VertPos);

	// Compute w, the projection of the view vector onto the tangent plane of the surface, must be in view space
	float contour = dot(viewer, normal);
	vec3 w = normalize(viewer - (contour * normal));

	vec3 scaled = w * 0.5 + vec3(0.5);
	gl_FragColor = vec4(scaled, 1.0);
}
`;

//fragment shader for Cel+Contour Shading that takes in the interpolated normals and displays light diffuse + ambient
//both light and normals need to be in view space for this to work
const _ContourFS = `

uniform vec3 diffuse_color;
uniform vec3 ambient_color;

varying vec3 v_ViewLightPosition;
varying vec3 v_ViewLightTargetPosition;

varying vec3 v_NormalInterp;
varying vec3 v_VertPos;

void main() {
	vec3 scaled = v_NormalInterp * 0.5 + vec3(0.5);

	vec3 normal = normalize(v_NormalInterp);
	vec3 light_direction = normalize(v_ViewLightTargetPosition - v_ViewLightPosition);
	vec3 viewer = normalize(-v_VertPos);

	float strength = dot(light_direction, normal) * 0.5 + 0.5;

	float contour = dot(viewer, normal);

	if ((contour <= 0.175 && contour >= -0.175)) {
		gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
	} else {
		if (strength > 0.8) {
			gl_FragColor = vec4(diffuse_color + ambient_color, 1.0);
		} else if (strength > 0.6) {
			gl_FragColor = vec4((diffuse_color * vec3(0.75)) + ambient_color, 1.0);
		} else if (strength > 0.4) {
			gl_FragColor = vec4((diffuse_color * vec3(0.5)) + ambient_color, 1.0);
		} else if (strength > 0.2) {
			gl_FragColor = vec4((diffuse_color * vec3(0.25)) + ambient_color, 1.0);
		} else {
			gl_FragColor = vec4((diffuse_color * vec3(0.0)) + ambient_color, 1.0);
		}
	}
}
`;

//vertex shader that takes in an offset and dialates each vertex along its normal by that offset to create a bigger shape
const _OutlineVS = `

uniform float offset;

void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * offset, 1.0);
}
`;

//fragment shader that displays the new shape in a cyan color, intended to be drawn under a shape to give it a silhouette
const _OutlineFS = `

void main() {
	gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

class BasicWorldDemo {
	constructor() {
		this._Initialize();
	}

	_Initialize() {
		
		//create save image link
		var saveLink = document.createElement('div');
        saveLink.style.position = 'absolute';
        saveLink.style.top = '10px';
        saveLink.style.width = '100%';
        saveLink.style.background = 'none';
        saveLink.style.textAlign = 'center';
        saveLink.innerHTML =
            '<a href="#" style="color: red;" id="saveLink">Save Frame</a>';
        document.body.appendChild(saveLink);
        document.getElementById("saveLink").addEventListener('click', () => {
			this._SaveAsImage();
		});

		//create threejs renderer
		this._threejs = new THREE.WebGLRenderer({
			antialias: true,
			preserveDrawingBuffer: true,
		});
		this._threejs.shadowMap.enabled = true;
		this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
		this._threejs.setPixelRatio(window.devicePixelRatio);
		this._threejs.setSize(window.innerWidth, window.innerHeight);

		document.body.appendChild(this._threejs.domElement);

		window.addEventListener('resize', () => {
			this._OnWindowResize();
		}, false);

		//create camera
		const fov = 60;
		const aspect = 1920 / 1080;
		const near = 1.0;
		const far = 1000.0;
		this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
		//this._camera = new THREE.OrthographicCamera(-500,500,500, -500, 0.0, far);
		this._camera.position.set(10, 2, 5);

		//uses multiple scenes, one used for outlines and casting object shadows, the other used for shading objects themselves
		this._scene = new THREE.Scene();
		this._outScene = new THREE.Scene();
		this._outScene.background = new THREE.Color(0xffffff);

		//create directional light
		let light = new THREE.DirectionalLight(0xffffff, 1.0);
		light.position.set(20, 100, 10);
		light.target.position.set(0, 0, 0);
		light.castShadow = true;
		light.shadow.bias = -0.001;
		light.shadow.mapSize.width = 2048;
		light.shadow.mapSize.height = 2048;
		light.shadow.camera.near = 0.1;
		light.shadow.camera.far = 500.0;
		light.shadow.camera.near = 0.5;
		light.shadow.camera.far = 500.0;
		light.shadow.camera.left = 100;
		light.shadow.camera.right = -100;
		light.shadow.camera.top = 100;
		light.shadow.camera.bottom = -100;
		this._scene.add(light);

		//create directional light helper
		let dirLightHelper = new THREE.DirectionalLightHelper(light, 5);
		//this._scene.add(dirLightHelper);

		//create ambient light
		let amblight = new THREE.AmbientLight(0x101010);
		this._scene.add(amblight);

		//allow user to have orbit controls
		const controls = new OrbitControls(
			this._camera, this._threejs.domElement);
		controls.target.set(0, 5, 0);
		controls.update();

		//my shaders
		let myNormalShader = new THREE.ShaderMaterial({
			uniforms: {},
			vertexShader: _VS,
			fragmentShader: _NormalFS,
		});

		let myViewerShader = new THREE.ShaderMaterial({
			uniforms: {},
			vertexShader: _VS,
			fragmentShader: _ViewerFS,
		});

		let myWShader = new THREE.ShaderMaterial({
			uniforms: {},
			vertexShader: _VS,
			fragmentShader: _WFS,
		});
		let animeShader = new THREE.ShaderMaterial({
			uniforms: {
				light_pos: {
					value: light.getWorldPosition()
				},
				diffuse_color: {
					value: light.color
				},
				light_target: {
					value: light.target.getWorldPosition()
				},
				ambient_color: {
					value: amblight.color
				}
			},
			vertexShader: _AnimeVS,
			fragmentShader: _ContourFS,
		});
		animeShader.transparent = true;

		let mySihouetteShader = new THREE.ShaderMaterial({
			uniforms: {
				offset: {
					value: 0.1
				}
			},
			vertexShader: _OutlineVS,
			fragmentShader: _OutlineFS
		})

		//geometries
		let sphere = new THREE.SphereGeometry(3, 16, 16);
		let torus = new THREE.TorusGeometry(2, 1, 16, 50);
		let torusKnot = new THREE.TorusKnotGeometry(2, 0.6, 100, 16);

		//helper to manually calculate vertices and faces for STLLoaded models
		let manualVertices = function (object) {
			object.computeBoundingBox();
            object.computeVertexNormals();

		   	var attrib = object.getAttribute('position');
            if(attrib === undefined) {
                throw new Error('a given BufferGeometry object must have a position attribute.');
            }
            var positions = attrib.array;
            var vertices = [];

			//manually put in the xyz coordinates for each vertex
            for(var i = 0, n = positions.length; i < n; i += 3) {
                var x = positions[i];
                var y = positions[i + 1];
                var z = positions[i + 2];
                vertices.push(new THREE.Vector3(x, y, z));
            }

            var faces = [];

			//for each group of three vertices, create a face for them
            for(var i = 0, n = vertices.length; i < n; i += 3) {
                faces.push(new THREE.Face3(i, i + 1, i + 2));
            }

			//merges duplicate vertices, allowing faces to share vertices
			var geometry = new THREE.Geometry();
            geometry.vertices = vertices;
            geometry.faces = faces;
            geometry.computeFaceNormals();              
            geometry.mergeVertices()
            geometry.computeVertexNormals();

			var toReturn = new THREE.BufferGeometry();
			toReturn.fromGeometry(geometry);

			return toReturn;
		}

		const loader = new STLLoader();
		const scene = this._scene;
		const outScene = this._outScene;
		var shader;

		//determines which shader to apply on the mesh
		//0 = normals, 1 = view vectors, 2 = w vectors, 3 = anime
		const shaderOption = 3;

		switch (shaderOption) {
			case 0:
				shader = myNormalShader;
				break;
			case 1:
				shader = myViewerShader;
				break;
			case 2:
				shader = myWShader;
				break;
			default:
				shader = animeShader;
		}

		//determines which shader to apply on the mesh
		//false = cel shading, true = show silhouette outlines
		const silhouetteOption = true;

		//determines which mesh to put on the scene
		//1 = sphere, 2 = torus, 3 = torusKnot, 4 = Suzanne, 5 = Ajax bust, 6 = Stanford Lucy, 7 = Utah Teapot, 8 = Amber, 9 = Vanilla, 0 = Pekora
		const shapeOption = 8;

		//add mesh to the scene based off what shapeOption is chosen
		switch (shapeOption) {
			case 1:
				const sph = new THREE.Mesh(sphere, shader);
				sph.position.set(0, 5, 0);
				sph.castShadow = true;
				this._scene.add(sph);
				this._outScene.add(sph.clone());

				if (silhouetteOption) {
					const sphOutline = new THREE.Mesh(sphere, mySihouetteShader);
					sphOutline.material.depthWrite = false;
					sphOutline.position.copy(sph.position);
					sphOutline.quaternion.copy(sph.quaternion);
					this._outScene.add(sphOutline);
				}
				break;
			case 2:
				const tor = new THREE.Mesh(torus, shader);
				tor.position.set(0, 5, 0);
				tor.castShadow = true;
				this._scene.add(tor);
				this._outScene.add(tor.clone());

				if (silhouetteOption) {
					const torOutline = new THREE.Mesh(torus, mySihouetteShader);
					torOutline.material.depthWrite = false;
					torOutline.position.copy(tor.position);
					torOutline.quaternion.copy(tor.quaternion);
					this._outScene.add(torOutline);
				}
				break;
			case 3:
				const tk = new THREE.Mesh(torusKnot, shader);
				tk.position.set(0, 5, 0);
				tk.castShadow = true;
				this._scene.add(tk);
				this._outScene.add(tk.clone());

				if (silhouetteOption) {
					const tkOutline = new THREE.Mesh(torusKnot, shader);
					tkOutline.material.depthWrite = false;
					tkOutline.position.copy(tk.position);
					tkOutline.quaternion.copy(tk.quaternion);
					this._outScene.add(tkOutline);
				}
				break;
			case 4:
				loader.load(
					'models/Suzanne.stl',
					function (geometry) {
						var suzGeo = manualVertices(geometry);
						var suz = new THREE.Mesh(suzGeo, shader);
						suz.position.set(0, 5, 0);
						suz.rotateOnAxis(new THREE.Vector3(0,1,0), 1.571);
						suz.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						suz.scale.set(3, 3, 3);
						suz.castShadow = true;
						scene.add(suz);
						outScene.add(suz.clone());

						if (silhouetteOption) {
							const suzOutline = new THREE.Mesh(suzGeo, mySihouetteShader);
							suzOutline.material.depthWrite = false;
							suzOutline.position.copy(suz.position);
							suzOutline.quaternion.copy(suz.quaternion);
							suzOutline.scale.copy(suz.scale);
							outScene.add(suzOutline);
						}
					},
					(xhr) => {
						console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
					},
					(error) => {
						console.log(error)
					}
				)
				break;
			case 5:
				loader.load(
					'models/ajax.stl',
					function (geometry) {
						var ajaxGeo = manualVertices(geometry);
						var ajax = new THREE.Mesh(ajaxGeo, shader);
						ajax.position.set(0, 2, 2.5);
						ajax.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						ajax.scale.set(0.05, 0.05, 0.05);
						ajax.castShadow = true;
						scene.add(ajax);
						outScene.add(ajax.clone());

						if (silhouetteOption) {
							const ajaxOutline = new THREE.Mesh(ajaxGeo, mySihouetteShader);
							ajaxOutline.material.depthWrite = false;
							ajaxOutline.position.copy(ajax.position);
							ajaxOutline.quaternion.copy(ajax.quaternion);
							ajaxOutline.scale.copy(ajax.scale);
							outScene.add(ajaxOutline);
						}
					},
					(xhr) => {
						console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
					},
					(error) => {
						console.log(error)
					}
				)
				break;
			case 6:
				loader.load(
					'models/lucy.stl',
					function (geometry) {
						var lucyGeo = manualVertices(geometry);
						var lucy = new THREE.Mesh(lucyGeo, shader);
						lucy.position.set(0, 2, -2);
						lucy.rotateOnAxis(new THREE.Vector3(0,1,0), -1.571);
						lucy.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						lucy.scale.set(0.05, 0.05, 0.05);
						lucy.castShadow = true;
						scene.add(lucy);
						outScene.add(lucy.clone());

						if (silhouetteOption) {
							const lucyOutline = new THREE.Mesh(lucyGeo, mySihouetteShader);
							lucyOutline.material.depthWrite = false;
							lucyOutline.position.copy(lucy.position);
							lucyOutline.quaternion.copy(lucy.quaternion);
							lucyOutline.scale.copy(lucy.scale);
							outScene.add(lucyOutline);
						}
					},
					(xhr) => {
						console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
					},
					(error) => {
						console.log(error)
					}
				)
				break;
			case 7:
				loader.load(
					'models/Utah_teapot.stl',
					function (geometry) {
						var teaGeo = manualVertices(geometry)
						var tea = new THREE.Mesh(teaGeo, shader);
						tea.position.set(0, 3, 0);
						tea.rotateOnAxis(new THREE.Vector3(0,1,0), 1.571);
						tea.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						tea.scale.set(0.5, 0.5, 0.5);
						tea.castShadow = true;
						scene.add(tea);
						outScene.add(tea.clone());

						if (silhouetteOption) {
							const teaOutline = new THREE.Mesh(teaGeo, mySihouetteShader);
							teaOutline.material.depthWrite = false;
							teaOutline.position.copy(tea.position);
							teaOutline.quaternion.copy(tea.quaternion);
							teaOutline.scale.copy(tea.scale);
							outScene.add(teaOutline);
						}
					},
					(xhr) => {
						console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
					},
					(error) => {
						console.log(error)
					}
				)
				break;
			case 8:
				loader.load(
					'models/amber.stl',
					function (geometry) {
						var amberGeo = manualVertices(geometry)
						var amber = new THREE.Mesh(amberGeo, shader);
						amber.position.set(0, 2, 0);
						amber.rotateOnAxis(new THREE.Vector3(0,1,0), -1.571);
						amber.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						amber.scale.set(0.5, 0.5, 0.5);
						amber.castShadow = true;
						scene.add(amber);
						outScene.add(amber.clone());

						if (silhouetteOption) {
							const amberOutline = new THREE.Mesh(amberGeo, mySihouetteShader);
							amberOutline.material.depthWrite = false;
							amberOutline.position.copy(amber.position);
							amberOutline.quaternion.copy(amber.quaternion);
							amberOutline.scale.copy(amber.scale);
							outScene.add(amberOutline);
						}
					},
					(xhr) => {
						console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
					},
					(error) => {
						console.log(error)
					}
				)
				break;
			case 9:
				loader.load(
					'models/vanilla.stl',
					function (geometry) {
						var vanGeo = manualVertices(geometry)
						var van = new THREE.Mesh(vanGeo, shader);
						van.position.set(0, 2, 0);
						van.rotateOnAxis(new THREE.Vector3(0,1,0), -1.571);
						van.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						van.scale.set(0.5, 0.5, 0.5);
						van.castShadow = true;
						scene.add(van);
						outScene.add(van.clone());

						if (silhouetteOption) {
							const vanOutline = new THREE.Mesh(vanGeo, mySihouetteShader);
							vanOutline.material.depthWrite = false;
							vanOutline.position.copy(van.position);
							vanOutline.quaternion.copy(van.quaternion);
							vanOutline.scale.copy(van.scale);
							outScene.add(vanOutline);
						}
					},
					(xhr) => {
						console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
					},
					(error) => {
						console.log(error)
					}
				)
				break;
			default:
				loader.load(
					'models/usada_pekora.stl',
					function (geometry) {
						var pekGeo = manualVertices(geometry)
						var pek = new THREE.Mesh(pekGeo, shader);
						pek.position.set(0, 1, 0);
						pek.rotateOnAxis(new THREE.Vector3(0,1,0), 1.571);
						pek.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						pek.scale.set(0.5, 0.5, 0.5);
						pek.castShadow = true;
						scene.add(pek);
						outScene.add(pek.clone());

						if (silhouetteOption) {
							const pekOutline = new THREE.Mesh(pekGeo, mySihouetteShader);
							pekOutline.material.depthWrite = false;
							pekOutline.position.copy(pek.position);
							pekOutline.quaternion.copy(pek.quaternion);
							pekOutline.scale.copy(pek.scale);
							outScene.add(pekOutline);
						}
					},
					(xhr) => {
						console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
					},
					(error) => {
						console.log(error)
					}
				)
		}


		this._totalTime = 0.0;

		this._RAF();
	}

	//event handler that handles when the window resizes
	_OnWindowResize() {
		this._camera.aspect = window.innerWidth / window.innerHeight;
		this._camera.updateProjectionMatrix();
		this._threejs.setSize(window.innerWidth, window.innerHeight);
	}

	//renderer that renders each and every frame
	_RAF() {
		requestAnimationFrame((t) => {
			if (this._previousRAF === null) {
				this._previousRAF = t;
			}

			this._RAF();

			//when rendering, render the outline scene, dont clear, then render regular scene, then let that clear
			this._threejs.render(this._outScene, this._camera);
			this._threejs.autoClear = false;
			this._threejs.render(this._scene, this._camera);
			this._threejs.autoClear = true;

			this._Step(t - this._previousRAF);
			this._previousRAF = t;
		});
	}

	//event handler that handles when the save image link is clicked
	_SaveAsImage() {
		var imgData, imgNode;

		try {
			var strMime = 'image/png';
			var strDownloadMime = "image/octet-stream";
			imgData = this._threejs.domElement.toDataURL(strMime);

			this._SaveFile(imgData.replace(strMime, strDownloadMime), "test.png");
		} catch (e) {
			console.log(this._threejs);
			console.log(e);
			return;
		}
	}

	//saves the jpeg of the currect view
	_SaveFile = function (strData, filename) {
        var link = document.createElement('a');
        if (typeof link.download === 'string') {
            document.body.appendChild(link); //Firefox requires the link to be in the body
            link.download = filename;
            link.href = strData;
            link.click();
            document.body.removeChild(link); //remove the link when done
        } else {
            location.replace(uri);
        }
    }

	//at each frame, this runs
	_Step(timeElapsed) {
		let timeElapsedS = 0.0;
		const up = new THREE.Vector3(0, 1, 0);

		if (!isNaN(timeElapsed)) {
			timeElapsedS = timeElapsed * 0.001;
		} else {
			timeElapsedS = 0.0;
		}

		this._totalTime += timeElapsedS;
		//const v = Math.sin(this._totalTime * 2.0);

		//rotate any object you need throughout time
		//this._sphere.rotateOnWorldAxis(up, 0.01);
		//this._bouncySphere.rotateOnWorldAxis(up, 0.001);
		//this._biggerSphere.rotation.y = -this._totalTime;

		const time = new THREE.Vector3(this._totalTime / 20, this._totalTime * 2, this._totalTime * 3);
		
		//add time as the uniform value to whatever object's material u need
		//this._bouncySphere.material.uniforms.time.value = time;
		//this._breathingBox.material.uniforms.time.value = time;
	}
}


let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
	_APP = new BasicWorldDemo();
});
