import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import * as AJAX from 'http://cdnjs.cloudflare.com/ajax/libs/three.js/r69/three.min.js';

import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';

const _VS = `

varying vec3 v_Normal;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    v_Normal = normalize(normal);
}
`;

const _FS = `

varying vec3 v_Normal;

void main() {
    vec3 scaled = v_Normal * 0.5 + vec3(0.5);
    gl_FragColor = vec4(scaled, 1.0);
    // gl_FragColor = vec4(1.0);
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
        this._camera.position.set(0, 25, 0);

        this._scene = new THREE.Scene();

        // //create directional light
        // let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
        // light.position.set(20, 100, 10);
        // light.target.position.set(0, 0, 0);
        // light.castShadow = true;
        // light.shadow.bias = -0.001;
        // light.shadow.mapSize.width = 2048;
        // light.shadow.mapSize.height = 2048;
        // light.shadow.camera.near = 0.1;
        // light.shadow.camera.far = 500.0;
        // light.shadow.camera.near = 0.5;
        // light.shadow.camera.far = 500.0;
        // light.shadow.camera.left = 100;
        // light.shadow.camera.right = -100;
        // light.shadow.camera.top = 100;
        // light.shadow.camera.bottom = -100;
        // this._scene.add(light);

        // //create ambient light
        // light = new THREE.AmbientLight(0x101010);
        // this._scene.add(light);

        //allow user to have orbit controls
        const controls = new OrbitControls(
         this._camera, this._threejs.domElement);
        controls.target.set(0, 0, 0);
        controls.update();

        // //create skybox
        // const loader = new THREE.CubeTextureLoader();
        // const texture = loader.load([
        //  './resources/posx.jpg',
        //  './resources/negx.jpg',
        //  './resources/posy.jpg',
        //  './resources/negy.jpg',
        //  './resources/posz.jpg',
        //  './resources/negz.jpg',
        // ]);
        // this._scene.background = texture;

        // //create a plane to hold our objects on top
        // const plane = new THREE.Mesh(
        //  new THREE.PlaneGeometry(100, 100, 10, 10),
        //  new THREE.MeshStandardMaterial({
        //      color: 0xFFFFFF,
        //  }));
        // plane.castShadow = false;
        // plane.receiveShadow = true;
        // plane.rotation.x = -Math.PI / 2;
        // this._scene.add(plane);

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

        // //boring sphere
        // const s1 = new THREE.Mesh(
        //  new THREE.SphereGeometry(2, 64, 64),
        //  new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
        // );
        // s1.position.set(-10, 5, 0);
        // s1.castShadow = true;
        // this._scene.add(s1);

        // //rotating colorful donut
        // const s2 = new THREE.Mesh(
        //  new THREE.TorusGeometry(2, 1, 16, 50),
        //  new THREE.ShaderMaterial({
        //      uniforms: {},
        //      vertexShader: _VS,
        //      fragmentShader: _FS,
        //  })
        // );
        // s2.position.set(10, 5, 0);
        // s2.castShadow = true;
        // s2.rotation.x = 10.0;
        // this._scene.add(s2);
        // this._sphere = s2;

        // torus
        const mesh_torus = new THREE.Mesh(
            new THREE.TorusGeometry(5, 2, 64, 64),
            new THREE.ShaderMaterial({
                uniforms: {},
                vertexShader: _VS,
                fragmentShader: _FS,
            })
        );
        mesh_torus.position.set(0, 0, 0);
        // mesh_torus.castShadow = true;
        mesh_torus.rotation.x = 10.0;
        mesh_torus.rotation.y = 10.0;
        this._scene.add(mesh_torus);

        // //rotating colorful outer sphere
        // const s3 = new THREE.Mesh(
        //  new THREE.SphereGeometry(100, 32, 32),
        //  new THREE.ShaderMaterial({
        //      uniforms: {},
        //      vertexShader: _VS,
        //      fragmentShader: _FS,
        //  })
        // );
        // s3.position.set(0, 0, 0);
        // s3.castShadow = false;
        // s3.material.side = THREE.DoubleSide;
        // this._scene.add(s3);
        // this._biggerSphere = s3;

        // //bounciness
        // const s4 = new THREE.Mesh(
        //  new THREE.SphereGeometry(30, 32, 32),
        //  new THREE.ShaderMaterial({
        //      uniforms: {
        //          time: {
        //              value: new THREE.Vector3(0, 0, 0),
        //          },
        //      },
        //      vertexShader: _VSWobble,
        //      fragmentShader: _FSWobble,
        //  })
        // );
        // s4.position.set(0, 0, 0);
        // s4.castShadow = false;
        // s4.material.side = THREE.DoubleSide;
        // s4.material.transparent = true;
        // s4.rotation.z = 1.571; //approx. pi/2
        // this._scene.add(s4);
        // this._bouncySphere = s4;

        // //breathing box
        // const s5 = new THREE.Mesh(
        //  new THREE.BoxGeometry(5, 5, 5, 10, 10, 10),
        //  new THREE.ShaderMaterial({
        //      uniforms: {
        //          time: {
        //              value: new THREE.Vector3(0, 0, 0),
        //          },
        //      },
        //      vertexShader: _VSBreathe,
        //      fragmentShader: _FS,
        //  })
        // );
        // s5.position.set(0, 5, 0);
        // s5.castShadow = false;
        // this._scene.add(s5);
        // this._breathingBox = s5;

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

        this._RAF();
        this._OnWindowResize();
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

            this._SaveFile(imgData.replace(strMime, strDownloadMime), "normals.png");
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
        // let timeElapsedS = 0.0;
        // const up = new THREE.Vector3(0, 1, 0);

        // if (!isNaN(timeElapsed)) {
        //     timeElapsedS = timeElapsed * 0.001;
        // } else {
        //     timeElapsedS = 0.0;
        // }

        // this._totalTime += timeElapsedS;
        // //const v = Math.sin(this._totalTime * 2.0);
        // this._sphere.rotateOnWorldAxis(up, 0.01);
        // this._bouncySphere.rotateOnWorldAxis(up, 0.001);
        // this._biggerSphere.rotation.y = -this._totalTime;

        // const time = new THREE.Vector3(this._totalTime / 20, this._totalTime * 2, this._totalTime * 3);
        // this._bouncySphere.material.uniforms.time.value = time;
        // this._breathingBox.material.uniforms.time.value = time;
    }
}


let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new BasicWorldDemo();
});
