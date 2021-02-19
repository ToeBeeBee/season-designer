import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.125.2/build/three.module.js';
import {SVGLoader} from 'https://cdn.jsdelivr.net/npm/three@0.125.2/examples/jsm/loaders/SVGLoader.js';

const vshader = `
uniform float size;
attribute float scale;

void main() {


    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

    gl_PointSize = (size + scale) * ( 300.0 / -mvPosition.z );

    gl_Position = projectionMatrix * mvPosition;

}
`;
const fshader = `
uniform vec3 color;
uniform float opacity;

void main() {

    if ( length( gl_PointCoord - vec2( 0.5, 0.5 ) ) > 0.475 ) discard;

    gl_FragColor = vec4( color, opacity );

}
`;


let logoFile = "https://toebeeben.com/season-designer/js/season.svg";


let logoSVGObject;
let loader = new SVGLoader();

let logoMesh;
let originalLogoVertecies;
let scales;

let frameCount = 0;

let particleLimit = 8000;

let paused = false;
let pauseCount = 0;
let pauseLength = 100;

let randomVectors = [];

let canvasArea = document.getElementById("canvas-area");

let scene;
let camera;
let renderer;

let ctx;

let playback = true;

let speed = 450 * 0.000005;

let hDist = 450;

let vDist = 1500;

let twDist = 1*0.0000001;

let dRandomSize = 20;

let dsize = 20*0.1;

document.addEventListener("load", initScene);
document.addEventListener("resize", onWindowResize);

function initScene() {

    scene = new THREE.Scene();
    camera;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    camera = new THREE.PerspectiveCamera(30, canvasArea.clientWidth / canvasArea.clientHeight, 0.1, 10000);
    camera.position.z = -955;
    camera.lookAt(0,0,0);

    renderer.setSize(canvasArea.clientWidth, canvasArea.clientHeight);
    //renderer.setClearColor( 0xaffa00, 1 );
    //renderer.clearColor();
    canvasArea.appendChild(renderer.domElement);

    loader.load(logoFile, addSVGtoScene,
        // called when loading is in progresses
        function ( xhr ) {
            console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        // called when loading has errors
        function ( error ) {
            console.log( 'An error happened' );
        }
    );

}

function addSVGtoScene( data ){

    let paths = data.paths;
    logoSVGObject = new THREE.Group();
    let averageCenter = new THREE.Vector3();
    for ( let i = 0; i < paths.length; i ++ ) {

        let path = paths[ i ];

        let material = new THREE.MeshBasicMaterial( {
            transparent: true,
            color: 0xFFFFFF,
            side: THREE.DoubleSide,
            depthWrite: false
        } );

        let shapes = path.toShapes( true );

        for ( let j = 0; j < shapes.length; j ++ ) {

            let shape = shapes[ j ];
            let geometry = new THREE.ShapeBufferGeometry( shape );
            let letterCenter = new THREE.Vector3();
            geometry.computeBoundingBox();
            geometry.boundingBox.getCenter(letterCenter);
            averageCenter.x += letterCenter.x;
            averageCenter.y += letterCenter.y;
            
            let mesh = new THREE.Mesh( geometry, material );
            logoSVGObject.add( mesh );
        }
        averageCenter.x = averageCenter.x / (shapes.length);
        averageCenter.y = averageCenter.y / (shapes.length);
    }
    let transform = new THREE.Matrix4();

    if(canvasArea.clientHeight > canvasArea.clientWidth){
        transform.makeScale(0.5, 0.5, 0.5)
    } else {
        transform.makeScale(1, 1, 1)
    }
    transform.multiply(new THREE.Matrix4().makeRotationZ(Math.PI));
    transform.multiply(new THREE.Matrix4().makeTranslation(-averageCenter.x, -averageCenter.y, 0));
    //
    logoSVGObject.applyMatrix4(transform);


    scene.add( logoSVGObject );
    renderer.render(scene, camera);

    let dotGeometry = new THREE.BufferGeometry();
    let dotMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color: {
                value: new THREE.Color(0xFFFFFF)
            },
            size: {
                value: dsize
            },
            opacity: {
                value:   1
            }
        },
        transparent: true,
        vertexShader: vshader,
        fragmentShader: fshader,
    });

    createLogoInParticles();
    calculateMeshAttributes();

    dotGeometry.setAttribute( 'position', new THREE.BufferAttribute( originalLogoVertecies.slice(), 3 ) );
    dotGeometry.setAttribute( 'scale', new THREE.BufferAttribute( scales.slice(), 1 ) );
    logoMesh = new THREE.Points(dotGeometry, dotMaterial);

    scene.add(logoMesh);


    animate();
}

function updateMesh(mesh){
    for(let i = 0; i < mesh.geometry.attributes.position.array.length; i++){
        mesh.geometry.attributes.position.array[i] = originalLogoVertecies[i] + (randomVectors[i]*animationPercentage(frameCount));
    }
    for(let i = 0; i < mesh.geometry.attributes.scale.array.length; i++){
        mesh.geometry.attributes.scale.array[i] = scales[i]*animationPercentage(frameCount);
        
    }
    mesh.material.uniforms.size.value = dsize;
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.attributes.scale.needsUpdate = true;
}

function canvasScaleFactor(){
    return Math.pow(canvasArea.clientWidth, 2) + Math.pow(canvasArea.clientHeight, 2);
}

function calculateMeshAttributes() {
    
    for(let i = 0; i < originalLogoVertecies.length; i++){
        let distFromCenter = 1-(
                                Math.pow(originalLogoVertecies[(i*3)],   2) + 
                                Math.pow(originalLogoVertecies[(i*3)+1], 2) +
                                Math.pow(originalLogoVertecies[(i*3)+2], 2)
                              )*twDist;

        randomVectors[(i*3)] = (hDist-Math.random()*hDist*2) *distFromCenter;
        randomVectors[(i*3)+1] = (vDist-Math.random()*vDist*2) *distFromCenter;
        randomVectors[(i*3)+2] = -200-(Math.random()*950);
    }
    for(let i = 0; i < scales.length; i++){
        scales[i] = Math.random()*dRandomSize;
    }

}

function createLogoInParticles() {
    let pointArray = [];
    let gl = renderer.getContext();
    let pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let screenHeightAtOrigin = 2 * Math.tan((camera.fov * Math.PI / 180)/2) * Math.abs(camera.position.z);
    let screenUnitDifference = screenHeightAtOrigin / gl.drawingBufferHeight;

    for (let i = 0; i < pixels.length/4; i++) {
            //read the pixel
            let brightness = (pixels[i*4] + pixels[i*4 + 1] + pixels[i*4 + 2]) / 3;

            if (brightness > 128) {
                if(i%(Math.ceil((pixels.length*0.001) / particleLimit)) == 0){
                    pointArray.push((Math.random()-0.5)+((gl.drawingBufferWidth / 2) - (i % gl.drawingBufferWidth))*screenUnitDifference);
                    pointArray.push((Math.random()-0.5)+((gl.drawingBufferHeight / 2) - (i / gl.drawingBufferWidth))*-1*screenUnitDifference);
                    pointArray.push(0);
                }
            };
    }
    
    originalLogoVertecies = new Float32Array(pointArray.length);
    scales = new Float32Array(pointArray.length/3);
    for(let i = 0; i < pointArray.length; i++){
            scales[i%3] = 0;
            originalLogoVertecies[i] = pointArray[i];
    }

    for(let i = 0; i < scales.length; i++){
        scales[i%3] = 0;
    }
}


function onWindowResize() {
    camera.aspect = canvasArea.clientWidth / canvasArea.clientHeight;

    camera.updateProjectionMatrix();
    renderer.setSize(canvasArea.clientWidth, canvasArea.clientHeight);

}

function sigmoid(t, r) {
    return 1 / (1 + Math.pow(Math.E, -(r + ((r * -1.78) * t))));
}

function pingpong(value, range1, range2){
    let diff = range2 - range1;
    value = value % (2*diff);
    if(value < diff){
        return range1+value;
    } else {
        return range1+(diff-(value-diff));
    }
}

function animationPercentage(time) {
    return sigmoid(pingpong(time, 0, 1), -9);

}

// Take the value inside of a range and returns as a percentage 
function percentageBetweenValues(input, start, end){
    let difference = end - start;
    let distanceIntoRange = input - start;
    return distanceIntoRange / difference; 
}

function animate() {
    // camera.position.z = 0;
    // camera.position.x = 900;
    // camera.lookAt(0,0,0);
    requestAnimationFrame(animate);
    if (playback) {
        updateMesh(logoMesh);

        if(!paused && animationPercentage(frameCount) < animationPercentage(speed)){
            paused = true;
        }
        if(paused && pauseCount >= pauseLength){
            pauseCount = 0;
            frameCount = speed;
            paused = false;
        }
        if(!paused){
            frameCount+=speed;
        } else {
            pauseCount++;
        }
        logoMesh.material.uniforms.opacity.value = percentageBetweenValues(animationPercentage(frameCount), 0.0, 0.0005);
        logoSVGObject.children[0].material.opacity =  1.1-percentageBetweenValues(animationPercentage(frameCount), 0.0, 0.0005);
        
        renderer.render(scene, camera);
    }
}


window.onresize = onWindowResize;
