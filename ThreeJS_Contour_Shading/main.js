import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.120.1/examples/jsm/loaders/STLLoader.js';

//vertex shader that passes normals
const _VS = `

varying vec3 v_Normal;

void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	v_Normal = normal;
}
`;

//fragment shader that displays normals
const _FS = `

varying vec3 v_Normal;

void main() {
	vec3 scaled = v_Normal * 0.5 + vec3(0.5);
	gl_FragColor = vec4(scaled, 1.0);
}
`;

//vertex shader for Cel Shading that just passes Phong-interpolated normals and the light position and target in view space
const _CelVS = `

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

//fragment shader for Cel Shading that takes in the interpolated normals and displays light diffuse + ambient + specular
//both light and normals need to be in view space for this to work
const _CelPhongFS = `

uniform vec3 diffuse_color;
uniform vec3 ambient_color;
uniform vec3 specular_color;

varying vec3 v_ViewLightPosition;
varying vec3 v_ViewLightTargetPosition;

varying vec3 v_NormalInterp;
varying vec3 v_VertPos;

void main() {
	vec3 scaled = v_NormalInterp * 0.5 + vec3(0.5);

	vec3 normal = -normalize(v_NormalInterp);
	vec3 light_direction = normalize(v_ViewLightTargetPosition - v_ViewLightPosition);

	float lambertian = max(dot(-light_direction, normal), 0.0);
	float specular = 0.0;
	if (lambertian > 0.0) {
		vec3 reflection = reflect(light_direction, normal);
		vec3 viewer = normalize(-v_VertPos);
		specular = pow(max(dot(reflection, -viewer), 0.0), 70.0);
	}

	vec3 origColor = vec3(lambertian * diffuse_color + ambient_color + specular * specular_color);
	float greyscale = dot(origColor.rgb, vec3(0.299, 0.587, 0.114));

	if (greyscale > 0.8) {
		gl_FragColor = vec4(diffuse_color, 1.0);
	} else if (greyscale > 0.6) {
		gl_FragColor = vec4(0.5210 * diffuse_color, 1.0);
	} else if (greyscale > 0.4) {
		gl_FragColor = vec4(0.2159 * diffuse_color, 1.0);
	} else if (greyscale > 0.2) {
		gl_FragColor = vec4(0.0513 * diffuse_color, 1.0);
	} else {
		gl_FragColor = vec4(0.0 * diffuse_color, 1.0);
	}
}
`;

//fragment shader for Cel Shading that takes in the interpolated normals and displays light diffuse + ambient
//both light and normals need to be in view space for this to work
//lambertian light model NOT USED since all surface with normals 90 degrees or more away from light vector will appear as black
//appearently colors scale nonlinearly, to get 1/2 black, multiply 0.5 with 0xffffff. resulting color isnt (.5,.5,.5), its actually (.2159,.2159,.2159) 
const _CelFS = `

uniform vec3 diffuse_color;
uniform vec3 ambient_color;

varying vec3 v_ViewLightPosition;
varying vec3 v_ViewLightTargetPosition;

varying vec3 v_NormalInterp;
varying vec3 v_VertPos;

void main() {
	vec3 scaled = v_NormalInterp * 0.5 + vec3(0.5);

	vec3 normal = -normalize(v_NormalInterp);
	vec3 light_direction = normalize(v_ViewLightTargetPosition - v_ViewLightPosition);

	float strength = dot(-light_direction, normal) * 0.5 + 0.5;

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

	vec3 normal = -normalize(v_NormalInterp);
	vec3 light_direction = normalize(v_ViewLightTargetPosition - v_ViewLightPosition);
	vec3 viewer = normalize(-v_VertPos);

	float strength = dot(-light_direction, normal) * 0.5 + 0.5;

	float contour = dot(viewer, normal);

	if ((contour <= 0.1 && contour >= -0.1)) {
		gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
	} else {
		if (strength > 0.8) {
			gl_FragColor = vec4(diffuse_color + ambient_color, 0.0);
		} else if (strength > 0.6) {
			gl_FragColor = vec4((diffuse_color * vec3(0.75)) + ambient_color, 0.0);
		} else if (strength > 0.4) {
			gl_FragColor = vec4((diffuse_color * vec3(0.5)) + ambient_color, 0.0);
		} else if (strength > 0.2) {
			gl_FragColor = vec4((diffuse_color * vec3(0.25)) + ambient_color, 0.0);
		} else {
			gl_FragColor = vec4((diffuse_color * vec3(0.0)) + ambient_color, 0.0);
		}
	}
}
`;

//fragment shader for Cel+Suggestive Contour Shading that takes in the interpolated normals and displays light diffuse + ambient
//both light and normals need to be in view space for this to work
const _SuggestiveFS = `

uniform vec3 diffuse_color;
uniform vec3 ambient_color;

varying vec3 v_ViewLightPosition;
varying vec3 v_ViewLightTargetPosition;

varying vec3 v_NormalInterp;
varying vec3 v_VertPos;

void main() {
	vec3 scaled = v_NormalInterp * 0.5 + vec3(0.5);

	vec3 normal = -normalize(v_NormalInterp);
	vec3 light_direction = normalize(v_ViewLightTargetPosition - v_ViewLightPosition);
	vec3 viewer = normalize(-v_VertPos);

	float strength = dot(-light_direction, normal) * 0.5 + 0.5;

	float contour = dot(viewer, normal);

	// Compute derivative of dot(viewer, normal)
  	vec3 ndx = -dFdx(v_NormalInterp);
  	vec3 ndy = -dFdy(v_NormalInterp);
	vec3 vdx = -dFdx(v_VertPos);
	vec3 vdy = -dFdy(v_VertPos);
	float contourdx = dot(ndx, viewer) + dot(normal, vdx);
	float contourdy = dot(ndy, viewer) + dot(normal, vdy);
	vec2 dcontour = vec2(contourdx, contourdy);
	float contourdw = dot(dcontour, dcontour);

	// Compute 2nd derivative of dot(viewer, normal)
	vec3 ndxx = -dFdx(dFdx(v_NormalInterp));
  	vec3 ndyx = -dFdy(dFdx(v_NormalInterp));
	vec3 ndxy = -dFdx(dFdy(v_NormalInterp));
  	vec3 ndyy = -dFdy(dFdy(v_NormalInterp));
	vec3 vdxx = -dFdx(dFdx(v_VertPos));
	vec3 vdyx = -dFdy(dFdx(v_VertPos));
	vec3 vdxy = -dFdx(dFdy(v_VertPos));
	vec3 vdyy = -dFdy(dFdy(v_VertPos));
	float contourdxx = dot(ndxx, viewer) + (2.0 * dot(ndx, vdx)) + dot(normal, vdxx);
	float contourdyx = dot(ndyx, viewer) + (2.0 * dot(ndy, vdy)) + dot(normal, vdyx);
	float contourdxy = dot(ndxy, viewer) + (2.0 * dot(ndx, vdx)) + dot(normal, vdxy);
	float contourdyy = dot(ndyy, viewer) + (2.0 * dot(ndy, vdy)) + dot(normal, vdyy);
	mat2 ddcontour;
	ddcontour[0] = vec2(contourdxx, contourdyx);
	ddcontour[1] = vec2(contourdxy, contourdyy);
	float contourdww = dot(ddcontour[0], ddcontour[0]) + dot(ddcontour[1], ddcontour[1]);

	if (contourdw >= 0.0 && contourdw <= 0.001 && contourdww > 0.0) {
		gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
	} else {
		if (strength > 0.8) {
			gl_FragColor = vec4(diffuse_color + ambient_color, 0.0);
		} else if (strength > 0.6) {
			gl_FragColor = vec4((diffuse_color * vec3(0.75)) + ambient_color, 0.0);
		} else if (strength > 0.4) {
			gl_FragColor = vec4((diffuse_color * vec3(0.5)) + ambient_color, 0.0);
		} else if (strength > 0.2) {
			gl_FragColor = vec4((diffuse_color * vec3(0.25)) + ambient_color, 0.0);
		} else {
			gl_FragColor = vec4((diffuse_color * vec3(0.0)) + ambient_color, 0.0);
		}
	}
}
`;
//be sure to change all of the alpha values to 1 to actually see the cel shading

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
		this._camera.position.set(10, 2, 5);

		this._scene = new THREE.Scene();

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
		this._scene.add(dirLightHelper);

		//create ambient light
		let amblight = new THREE.AmbientLight(0x101010);
		this._scene.add(amblight);

		//allow user to have orbit controls
		const controls = new OrbitControls(
			this._camera, this._threejs.domElement);
		controls.target.set(0, 5, 0);
		controls.update();

		//create a plane to hold our objects on top
		const plane = new THREE.Mesh(
			new THREE.PlaneGeometry(100, 100, 10, 10),
			new THREE.MeshStandardMaterial({
				color: 0xFFFFFF,
			}));
		plane.castShadow = false;
		plane.receiveShadow = true;
		plane.rotation.x = -Math.PI / 2;
		this._scene.add(plane);

		const threeTone = new THREE.TextureLoader().load('gradientMaps/threeTone.jpg');
		threeTone.minFilter = THREE.NearestFilter;
		threeTone.magFilter = THREE.NearestFilter;

		const fourTone = new THREE.TextureLoader().load('gradientMaps/fourTone.jpg');
		fourTone.minFilter = THREE.NearestFilter;
		fourTone.magFilter = THREE.NearestFilter;

		const fiveTone = new THREE.TextureLoader().load('gradientMaps/fiveTone.jpg');
		fiveTone.minFilter = THREE.NearestFilter;
		fiveTone.magFilter = THREE.NearestFilter;

		//my shaders
		let myCelShader = new THREE.ShaderMaterial({
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
			vertexShader: _CelVS,
			fragmentShader: _CelFS,
		});

		let myContourShader = new THREE.ShaderMaterial({
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
			vertexShader: _CelVS,
			fragmentShader: _ContourFS,
		});
		myContourShader.transparent = true;

		let mySuggestiveShader = new THREE.ShaderMaterial({
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
			vertexShader: _CelVS,
			fragmentShader: _SuggestiveFS,
		});
		mySuggestiveShader.transparent = true;

		//threejs shaders
		let threeToon = new THREE.MeshToonMaterial({
			gradientMap: fiveTone,
			color: new THREE.Color(0xffffff)
		});

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
		var shader;

		//determines which shader to apply on the mesh
		//0 = threeToon, 1 = cel shading, 2 = show contours, 3 = show suggestive contours
		const shaderOption = 3;

		switch (shaderOption) {
			case 0:
				shader = threeToon;
				break;
			case 1:
				shader = myCelShader;
				break;
			case 2:
				shader = myContourShader;
				break;
			case 3:
				shader = mySuggestiveShader;
				break;
		}

		//determines which mesh to put on the scene
		//1 = sphere, 2 = torus, 3 = torusKnot, 4 = Suzanne, 5 = Ajax bust, 6 = Stanford Lucy, 0 = Utah Teapot
		const shapeOption = 5;

		//add mesh to the scene based off what shapeOption is chosen
		switch (shapeOption) {
			case 1:
				const sph = new THREE.Mesh(sphere, shader);
				sph.position.set(0, 5, 0);
				sph.castShadow = true;
				this._scene.add(sph);
				break;
			case 2:
				const tor = new THREE.Mesh(torus, shader);
				tor.position.set(0, 5, 0);
				tor.castShadow = true;
				this._scene.add(tor);
				break;
			case 3:
				const tk = new THREE.Mesh(torusKnot, shader);
				tk.position.set(0, 5, 0);
				tk.castShadow = true;
				this._scene.add(tk);
				break;
			case 4:
				loader.load(
					'models/Suzanne.stl',
					function (geometry) {
						var suz = new THREE.Mesh(manualVertices(geometry), shader);
						suz.position.set(0, 5, 0);
						suz.rotateOnAxis(new THREE.Vector3(0,1,0), 1.571);
						suz.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						suz.scale.set(3, 3, 3);
						suz.castShadow = true;
						scene.add(suz);
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
						var ajax = new THREE.Mesh(manualVertices(geometry), shader);
						ajax.position.set(0, 2, 2.5);
						ajax.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						ajax.scale.set(0.05, 0.05, 0.05);
						ajax.castShadow = true;
						scene.add(ajax);
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
						var ajax = new THREE.Mesh(manualVertices(geometry), shader);
						ajax.position.set(0, 2, -2);
						ajax.rotateOnAxis(new THREE.Vector3(0,1,0), -1.571);
						ajax.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						
						ajax.scale.set(0.05, 0.05, 0.05);
						ajax.castShadow = true;
						scene.add(ajax);
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
					'models/Utah_teapot.stl',
					function (geometry) {
						var tea = new THREE.Mesh(manualVertices(geometry), shader);
						tea.position.set(0, 3, 0);
						tea.rotateOnAxis(new THREE.Vector3(0,1,0), 1.571);
						tea.rotateOnAxis(new THREE.Vector3(1,0,0), -1.571);
						tea.scale.set(0.5, 0.5, 0.5);
						tea.castShadow = true;
						scene.add(tea);
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

			this._threejs.render(this._scene, this._camera);
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
