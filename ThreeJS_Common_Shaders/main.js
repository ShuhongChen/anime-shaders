import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';

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

		//flat shaded sphere
		const flatShadedSphere = new THREE.Mesh(
			new THREE.SphereGeometry(3, 16, 16),
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
		flatShadedSphere.position.set(10, 5, 0);
		flatShadedSphere.castShadow = true;
		this._scene.add(flatShadedSphere);

		//gouraud shaded sphere
		const gouraudShadedSphere = new THREE.Mesh(
			new THREE.SphereGeometry(3, 16, 16),
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
				vertexShader: _GouraudVS,
				fragmentShader: _GouraudFS,
			})
		);
		gouraudShadedSphere.position.set(-10, 5, 0);
		gouraudShadedSphere.castShadow = true;
		this._scene.add(gouraudShadedSphere);

		//phong shaded sphere
		const phongShadedSphere = new THREE.Mesh(
			new THREE.SphereGeometry(3, 16, 16),
			new THREE.ShaderMaterial({
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
			})
		);
		phongShadedSphere.position.set(0, 5, 10);
		phongShadedSphere.castShadow = true;
		this._scene.add(phongShadedSphere);

		//lambert shaded sphere
		const lambertShadedSphere = new THREE.Mesh(
			new THREE.SphereGeometry(3, 16, 16),
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
				vertexShader: _LambertVS,
				fragmentShader: _LambertFS,
			})
		);
		lambertShadedSphere.position.set(0, 5, -10);
		lambertShadedSphere.castShadow = true;
		this._scene.add(lambertShadedSphere);

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
