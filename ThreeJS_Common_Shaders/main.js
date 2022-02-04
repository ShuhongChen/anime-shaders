import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';

const _VS = `

varying vec3 v_Normal;

void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	v_Normal = normal;
}
`;

const _FS = `

varying vec3 v_Normal;

void main() {
	vec3 scaled = v_Normal * 0.5 + vec3(0.5);
	gl_FragColor = vec4(scaled, 1.0);
}
`;

const _FlatVS = `

varying vec3 v_ViewPosition;

void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0 );
	v_ViewPosition = - mvPosition.xyz;
}
`;

const _FlatFS = `

uniform vec3 light_pos;
uniform vec3 light_color;
uniform vec3 light_target;

varying vec3 v_ViewPosition;

void main() {
	vec3 faceNormal = normalize( cross( dFdx( v_ViewPosition ), dFdy( v_ViewPosition ) ) );
	vec3 scaled = faceNormal * 0.5 + vec3(0.5);

	vec3 light_direction = normalize(light_target - light_pos);
	gl_FragColor = vec4(max(dot(-light_direction, faceNormal), 0.0) * light_color, 1.0);
}
`;

//max(dot(-light_direction, faceNormal), 0.0) * light_color

class BasicWorldDemo {
	constructor() {
		this._Initialize();
	}

	_Initialize() {
		this._threejs = new THREE.WebGLRenderer({
			antialias: true,
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
		let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
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

		//flat shaded sphere
		const flatShadedSphere = new THREE.Mesh(
			new THREE.SphereGeometry(4, 32, 32),
			new THREE.ShaderMaterial({
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
			})
		);
		flatShadedSphere.position.set(0, 5, 0);
		flatShadedSphere.castShadow = false;
		this._scene.add(flatShadedSphere);

		this._totalTime = 0.0;

		this._RAF();
	}

	_OnWindowResize() {
		this._camera.aspect = window.innerWidth / window.innerHeight;
		this._camera.updateProjectionMatrix();
		this._threejs.setSize(window.innerWidth, window.innerHeight);
	}

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
