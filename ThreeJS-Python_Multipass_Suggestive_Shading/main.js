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
`

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
			antialias: false,
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

		this._scene = new THREE.Scene();

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
		//0 = normals, 1 = view vectors, 2 = w vectors
		const shaderOption = 1;

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
		}

		//determines which mesh to put on the scene
		//1 = sphere, 2 = torus, 3 = torusKnot, 4 = Suzanne, 5 = Ajax bust, 6 = Stanford Lucy, 0 = Utah Teapot
		const shapeOption = 6;

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
