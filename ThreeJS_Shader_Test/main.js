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
	vec4 light_target_mv = modelViewMatrix * vec4(light_target, 1.0);
	vec4 light_pos_mv = modelViewMatrix * vec4(light_pos, 1.0);
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
	v_Normal = normal;
}
`;

//fragment shader for Gouraud Shading that takes in the normals and displays light diffuse
//both light and normals need to be in local/world space for this to work
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

	vec4 light_target_mv = modelViewMatrix * vec4(light_target, 1.0);
	vec4 light_pos_mv = modelViewMatrix * vec4(light_pos, 1.0);
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

	vec4 light_target_mv = modelViewMatrix * vec4(light_target, 1.0);
	vec4 light_pos_mv = modelViewMatrix * vec4(light_pos, 1.0);
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
		this._camera.position.set(75, 20, 0);

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
		controls.target.set(0, 20, 0);
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

		//my shaders
		let myFlatShader = new THREE.ShaderMaterial({
			uniforms: {
				light_pos: {
					value: light.position
				},
				light_color: {
					value: light.color
				},
				light_target: {
					value: light.target.position
				}
			},
			vertexShader: _FlatVS,
			fragmentShader: _FlatFS,
		});

		let myGouraudShader = new THREE.ShaderMaterial({
			uniforms: {
				light_pos: {
					value: light.position
				},
				light_color: {
					value: light.color
				},
				light_target: {
					value: light.target.position
				}
			},
			vertexShader: _GouraudVS,
			fragmentShader: _GouraudFS,
		});

		let myPhongShader = new THREE.ShaderMaterial({
			uniforms: {
				light_pos: {
					value: light.position
				},
				diffuse_color: {
					value: light.color
				},
				light_target: {
					value: light.target.position
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
					value: light.position
				},
				light_color: {
					value: light.color
				},
				light_target: {
					value: light.target.position
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
		let ajax = undefined;

		const loader = new STLLoader();
		loader.load(
    		'models/ajax.stl',
    		function (geometry) {
        		ajax = geometry
    		},
    		(xhr) => {
        		console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
    		},
    		(error) => {
        		console.log(error)
    		}
		)

		/**
		 * My Flat Shader
		 */

		//flat shaded sphere
		const sph1 = new THREE.Mesh(sphere, myFlatShader);
		sph1.position.set(-40, 5, 40);
		sph1.castShadow = true;
		this._scene.add(sph1);

		//flat shaded torus
		const tor1 = new THREE.Mesh(torus, myFlatShader);
		tor1.position.set(-30, 5, 40);
		tor1.castShadow = true;
		this._scene.add(tor1);

		//flat shaded torus knot
		const tk1 = new THREE.Mesh(torusKnot, myFlatShader);
		tk1.position.set(-20, 5, 40);
		tk1.castShadow = true;
		this._scene.add(tk1);

		//flat shaded ajax
		const aj1 = new THREE.Mesh(ajax, myFlatShader);
		aj1.material.side = THREE.DoubleSide;
		aj1.position.set(-10, 5, 40);
		aj1.castShadow = true;
		this._scene.add(aj1);

		/**
		 * My Gouraud Shader
		 */

		//gouraud shaded sphere
		const sph2 = new THREE.Mesh(sphere, myGouraudShader);
		sph2.position.set(-40, 5, 20);
		sph2.castShadow = true;
		this._scene.add(sph2);

		//gouraud shaded torus
		const tor2 = new THREE.Mesh(torus, myGouraudShader);
		tor2.position.set(-30, 5, 20);
		tor2.castShadow = true;
		this._scene.add(tor2);

		//gouraud shaded torus knot
		const tk2 = new THREE.Mesh(torusKnot, myGouraudShader);
		tk2.position.set(-20, 5, 20);
		tk2.castShadow = true;
		this._scene.add(tk2);

		/**
		 * My Phong Shader
		 */

		//phong shaded sphere
		const sph3 = new THREE.Mesh(sphere, myPhongShader);
		sph3.position.set(-40, 5, 0);
		sph3.castShadow = true;
		this._scene.add(sph3);

		//phong shaded torus
		const tor3 = new THREE.Mesh(torus, myPhongShader);
		tor3.position.set(-30, 5, 0);
		tor3.castShadow = true;
		this._scene.add(tor3);

		//phong shaded torus knot
		const tk3 = new THREE.Mesh(torusKnot, myPhongShader);
		tk3.position.set(-20, 5, 0);
		tk3.castShadow = true;
		this._scene.add(tk3);

		/**
		 * My Lambert Shader
		 */

		//lambert shaded sphere
		const sph4 = new THREE.Mesh(sphere, myLambertShader);
		sph4.position.set(-40, 5, -20);
		sph4.castShadow = true;
		this._scene.add(sph4);

		//lambert shaded torus
		const tor4 = new THREE.Mesh(torus, myLambertShader);
		tor4.position.set(-30, 5, -20);
		tor4.castShadow = true;
		this._scene.add(tor4);

		//lambert shaded torus knot
		const tk4 = new THREE.Mesh(torusKnot, myLambertShader);
		tk4.position.set(-20, 5, -20);
		tk4.castShadow = true;
		this._scene.add(tk4);



		/**
		 * Threejs Flat Shader
		 */

		//flat shaded sphere
		const sph5 = new THREE.Mesh(sphere, threeFlat);
		sph5.position.set(-40, 5, 30);
		sph5.castShadow = true;
		this._scene.add(sph5);

		//flat shaded torus
		const tor5 = new THREE.Mesh(torus, threeFlat);
		tor5.position.set(-30, 5, 30);
		tor5.castShadow = true;
		this._scene.add(tor5);

		//flat shaded torus knot
		const tk5 = new THREE.Mesh(torusKnot, threeFlat);
		tk5.position.set(-20, 5, 30);
		tk5.castShadow = true;
		this._scene.add(tk5);

		/**
		 * Threejs Gouraud Shader
		 */

		//gouraud shaded sphere
		const sph6 = new THREE.Mesh(sphere, threeGouraud);
		sph6.position.set(-40, 5, 10);
		sph6.castShadow = true;
		this._scene.add(sph6);

		//gouraud shaded torus
		const tor6 = new THREE.Mesh(torus, threeGouraud);
		tor6.position.set(-30, 5, 10);
		tor6.castShadow = true;
		this._scene.add(tor6);

		//gouraud shaded torus knot
		const tk6 = new THREE.Mesh(torusKnot, threeGouraud);
		tk6.position.set(-20, 5, 10);
		tk6.castShadow = true;
		this._scene.add(tk6);

		/**
		 * Threejs Phong Shader
		 */

		//phong shaded sphere
		const sph7 = new THREE.Mesh(sphere, threePhong);
		sph7.position.set(-40, 5, -10);
		sph7.castShadow = true;
		this._scene.add(sph7);

		//phong shaded torus
		const tor7 = new THREE.Mesh(torus, threePhong);
		tor7.position.set(-30, 5, -10);
		tor7.castShadow = true;
		this._scene.add(tor7);

		//phong shaded torus knot
		const tk7 = new THREE.Mesh(torusKnot, threePhong);
		tk7.position.set(-20, 5, -10);
		tk7.castShadow = true;
		this._scene.add(tk7);

		/**
		 * Threejs Lambert Shader
		 */

		//lambert shaded sphere
		const sph8 = new THREE.Mesh(sphere, threeLambert);
		sph8.position.set(-40, 5, -30);
		sph8.castShadow = true;
		this._scene.add(sph8);

		//lambert shaded torus
		const tor8 = new THREE.Mesh(torus, threeLambert);
		tor8.position.set(-30, 5, -30);
		tor8.castShadow = true;
		this._scene.add(tor8);

		//lambert shaded torus knot
		const tk8 = new THREE.Mesh(torusKnot, threeLambert);
		tk8.position.set(-20, 5, -30);
		tk8.castShadow = true;
		this._scene.add(tk8);

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
