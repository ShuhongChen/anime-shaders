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

		//create ambient light
		light = new THREE.AmbientLight(0x101010);
		this._scene.add(light);

		//allow user to have orbit controls
		const controls = new OrbitControls(
			this._camera, this._threejs.domElement);
		controls.target.set(0, 20, 0);
		controls.update();

		//create skybox
		const loader = new THREE.CubeTextureLoader();
		const texture = loader.load([
			'./resources/posx.jpg',
			'./resources/negx.jpg',
			'./resources/posy.jpg',
			'./resources/negy.jpg',
			'./resources/posz.jpg',
			'./resources/negz.jpg',
		]);
		this._scene.background = texture;

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

		//creates cubes
		/* const box = new THREE.Mesh(
		  new THREE.BoxGeometry(2, 2, 2),
		  new THREE.MeshStandardMaterial({
			  color: 0xFFFFFF,
		  }));
		box.position.set(0, 1, 0);
		box.castShadow = true;
		box.receiveShadow = true;
		this._scene.add(box);
	
		//creates more cubes
		for (let x = -8; x < 8; x++) {
		  for (let y = -8; y < 8; y++) {
			const box = new THREE.Mesh(
			  new THREE.BoxGeometry(2, 2, 2),
			  new THREE.MeshStandardMaterial({
				  color: 0x808080,
			  }));
			box.position.set(Math.random() + x * 5, Math.random() * 4.0 + 2.0, Math.random() + y * 5);
			box.castShadow = true;
			box.receiveShadow = true;
			this._scene.add(box);
		  }
		} */

		const s1 = new THREE.Mesh(
			new THREE.SphereGeometry(2, 32, 32),
			new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
		);
		s1.position.set(-10, 5, 0);
		s1.castShadow = true;
		this._scene.add(s1);

		const s2 = new THREE.Mesh(
			new THREE.TorusGeometry(2, 1, 16, 50),
			new THREE.ShaderMaterial({
				uniforms: {},
				vertexShader: _VS,
				fragmentShader: _FS,
			})
		);
		s2.position.set(10, 5, 0);
		s2.castShadow = true;
		this._scene.add(s2);
		this._sphere = s2;

		// const box = new THREE.Mesh(
		//   new THREE.SphereGeometry(2, 32, 32),
		//   new THREE.MeshStandardMaterial({
		//       color: 0xFFFFFF,
		//       wireframe: true,
		//       wireframeLinewidth: 4,
		//   }));
		// box.position.set(0, 0, 0);
		// box.castShadow = true;
		// box.receiveShadow = true;
		// this._scene.add(box);

		this._totalTime = 0.0;
		console.log("init: " + this._totalTime);

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

		//I dunno why this._totalTime always comes out as NaN as if the constructor never ran...
		if (isNaN(this._totalTime)) {
			this._totalTime = 0.0;
		}

		if (!isNaN(timeElapsed)) {
			timeElapsedS = timeElapsed * 0.001;
		} else {
			timeElapsedS = 0.0;
		}

		this._totalTime += timeElapsedS;
		//const v = Math.sin(this._totalTime * 2.0);
		this._sphere.rotation.y = this._totalTime;
	}
}


let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
	_APP = new BasicWorldDemo();
});
