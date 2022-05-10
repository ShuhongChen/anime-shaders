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

//vertex shader for Flat Shading that takes in light direction and calculates camera view of light and of the mesh
const _FlatVS = `

uniform vec3 light_pos;
uniform vec3 light_target;

varying vec3 v_ViewPosition;
varying vec3 v_ViewLightPosition;
varying vec3 v_ViewLightTargetPosition;

void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
	vec4 light_target_mv = viewMatrix * vec4(light_target, 1.0);
	vec4 light_pos_mv = viewMatrix * vec4(light_pos, 1.0);
	v_ViewPosition = - mvPosition.xyz;
	v_ViewLightPosition = - light_pos_mv.xyz;
	v_ViewLightTargetPosition = - light_target_mv.xyz;
}
`;

//fragment shader for Flat Shading that takes in view of light and of the mesh, calculates face normals, a displays light diffuse
//both light and normals need to be in view space for this to work
const _FlatFS = `

uniform vec3 light_color;

varying vec3 v_ViewPosition;
varying vec3 v_ViewLightPosition;
varying vec3 v_ViewLightTargetPosition;

void main() {
	vec3 faceNormal = -normalize( cross( dFdx( v_ViewPosition ), dFdy( v_ViewPosition ) ) );
	vec3 scaled = faceNormal * 0.5 + vec3(0.5);

	vec3 light_direction = normalize(v_ViewLightTargetPosition - v_ViewLightPosition);
	gl_FragColor = vec4(max(dot(-light_direction, faceNormal), 0.0) * light_color, 1.0);
}
`;

//vertex shader for Gouraud Shading that just passes vertex normals (default glsl normals)
const _GouraudVS = `

varying vec3 v_Normal;

void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	
	vec4 normal_mv = inverse(transpose(modelMatrix)) * vec4(normal, 0.0);
	v_Normal = normalize(normal_mv.xyz);
}
`;

//fragment shader for Gouraud Shading that takes in the normals and displays light diffuse
//both light and normals need to be in world space for this to work
const _GouraudFS = `

uniform vec3 light_color;
uniform vec3 light_pos;
uniform vec3 light_target;

varying vec3 v_Normal;

void main() {
	vec3 scaled = v_Normal * 0.5 + vec3(0.5);

	vec3 light_direction = normalize(light_target - light_pos);
	gl_FragColor = vec4(max(dot(-light_direction, v_Normal), 0.0) * light_color, 1.0);
}
`;

//vertex shader for Phong Shading that just passes vertex normals (default glsl normals)
const _PhongVS = `

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

//fragment shader for Phong Shading that takes in the interpolated normals and displays light diffuse + ambient + specular
//both light and normals need to be in view space for this to work
const _PhongFS = `

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

	gl_FragColor = vec4(lambertian * diffuse_color + ambient_color + specular * specular_color, 1.0);
}
`;

//vertex shader for Lambert Shading that just passes vertex normals (default glsl normals)
const _LambertVS = `

uniform vec3 light_pos;
uniform vec3 light_target;

varying vec3 v_ViewLightPosition;
varying vec3 v_ViewLightTargetPosition;

varying vec3 v_NormalInterp;

void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	v_NormalInterp = normalMatrix * normal;

	vec4 light_target_mv = viewMatrix * vec4(light_target, 1.0);
	vec4 light_pos_mv = viewMatrix * vec4(light_pos, 1.0);
	v_ViewLightPosition = - light_pos_mv.xyz;
	v_ViewLightTargetPosition = - light_target_mv.xyz;
}
`;

//fragment shader for Lambert Shading that takes in the Phong-interpolated normals and displays light diffuse
//both light and normals need to be in view space for this to work
const _LambertFS = `

uniform vec3 light_color;

varying vec3 v_ViewLightPosition;
varying vec3 v_ViewLightTargetPosition;

varying vec3 v_NormalInterp;

void main() {
	vec3 scaled = v_NormalInterp * 0.5 + vec3(0.5);

	vec3 normal = -normalize(v_NormalInterp);
	vec3 light_direction = normalize(v_ViewLightTargetPosition - v_ViewLightPosition);

	float lambertian = max(dot(-light_direction, normal), 0.0);
	gl_FragColor = vec4(lambertian * light_color, 1.0);
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
		this._camera.position.set(10, 10, 5);

		this._scene = new THREE.Scene();
		this._scene.background = new THREE.Color(0xffffff);

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

		//create a plane to hold our objects on top
		const plane = new THREE.Mesh(
			new THREE.PlaneGeometry(100, 100, 10, 10),
			new THREE.MeshStandardMaterial({
				color: 0xFFFFFF,
			}));
		plane.castShadow = false;
		plane.receiveShadow = true;
		plane.rotation.x = -Math.PI / 2;
		//this._scene.add(plane);

		//my shaders
		let myFlatShader = new THREE.ShaderMaterial({
			uniforms: {
				light_pos: {
					value: light.getWorldPosition()
				},
				light_color: {
					value: light.color
				},
				light_target: {
					value: light.target.getWorldPosition()
				}
			},
			vertexShader: _FlatVS,
			fragmentShader: _FlatFS,
		});

		let myGouraudShader = new THREE.ShaderMaterial({
			uniforms: {
				light_pos: {
					value: light.getWorldPosition()
				},
				light_color: {
					value: light.color
				},
				light_target: {
					value: light.target.getWorldPosition()
				}
			},
			vertexShader: _GouraudVS,
			fragmentShader: _GouraudFS,
		});

		let myPhongShader = new THREE.ShaderMaterial({
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
				},
				specular_color: {
					value: new THREE.Color(0xffffff)
				}
			},
			vertexShader: _PhongVS,
			fragmentShader: _PhongFS,
		});

		let myLambertShader = new THREE.ShaderMaterial({
			uniforms: {
				light_pos: {
					value: light.getWorldPosition()
				},
				light_color: {
					value: light.color
				},
				light_target: {
					value: light.target.getWorldPosition()
				}
			},
			vertexShader: _LambertVS,
			fragmentShader: _LambertFS,
		});

		//threejs shaders
		let threeFlat = new THREE.MeshPhongMaterial({
			flatShading: true,
			specular: new THREE.Color(0x000000),
			aoMapIntensity: 1.0
		});
		let threeGouraud = new THREE.MeshLambertMaterial({
			aoMapIntensity: 1.0,
		});
		let threePhong = new THREE.MeshPhongMaterial({
			specular: new THREE.Color(0xffffff),
		});
		let threeLambert = new THREE.MeshPhongMaterial({
			specular: new THREE.Color(0x000000),
			shininess: 70.0,
			aoMapIntensity: 1.0
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
		//0 = our flat, 1 = our gouraud, 2 = our lambert, 3 = our phong, 4 = threejs flat, 5 = threejs gouraud, 6 = threejs lambert, 7 = threejs phong
		const shaderOption = 0;

		switch (shaderOption) {
			case 0:
				shader = myFlatShader;
				break;
			case 1:
				shader = myGouraudShader;
				break;
			case 2:
				shader = myLambertShader;
				break;
			case 3:
				shader = myPhongShader;
				break;
			case 4:
				shader = threeFlat;
				break;
			case 5:
				shader = threeGouraud;
				break;
			case 6:
				shader = threeLambert;
				break;
			default:
				shader = threePhong;
		}

		//determines which mesh to put on the scene
		//1 = sphere, 2 = torus, 3 = torusKnot, 4 = Suzanne, 0 = Utah Teapot
		const shapeOption = 1;

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
						var suzGeo = manualVertices(geometry);
						var suz = new THREE.Mesh(suzGeo, shader);
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
			default:
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
