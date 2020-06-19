/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as handpose from '@tensorflow-models/handpose';

function isMobile() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isAndroid || isiOS;
}

let model, ctx, videoWidth, videoHeight, scatterGLHasInitialized = false, video, canvas, scatterGL,
  fingerLookupIndices = {
    thumb: [0, 1, 2, 3, 4],
    indexFinger: [0, 5, 6, 7, 8],
    middleFinger: [0, 9, 10, 11, 12],
    ringFinger: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20]
  }; // for rendering each finger as a polyline

  
// These anchor points allow the hand pointcloud to resize according to its
// position in the input.
// const ANCHOR_POINTS = [[0, 0, 0], [0, -VIDEO_HEIGHT, 0],
// [-VIDEO_WIDTH, 0, 0], [-VIDEO_WIDTH, -VIDEO_HEIGHT, 0]];

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 500;
const mobile = isMobile();
// Don't render the point cloud on mobile in order to maximize performance and
// to avoid crowding limited screen space.
const renderPointcloud = mobile === false;

const state = {};
const stats = new Stats();


if (renderPointcloud) {
  state.renderPointcloud = true;
}

function setupDatGui() {
  const gui = new dat.GUI();

  if (renderPointcloud) {
    gui.add(state, 'renderPointcloud').onChange(render => {
      document.querySelector('#scatter-gl-container').style.display =
        render ? 'inline-block' : 'none';
    });
  }
}

function drawPoint(ctx, y, x, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
}

function drawKeypoints(ctx, keypoints) {
  const keypointsArray = keypoints;

  for (let i = 0; i < keypointsArray.length; i++) {
    const y = keypointsArray[i][0];
    const x = keypointsArray[i][1];
    drawPoint(ctx, x - 2, y - 2, 3);
  }

  const fingers = Object.keys(fingerLookupIndices);
  for (let i = 0; i < fingers.length; i++) {
    const finger = fingers[i];
    const points = fingerLookupIndices[finger].map(idx => keypoints[idx]);
    drawPath(ctx, points, false);
  }
}

function drawPath(ctx, points, closePath) {
  const region = new Path2D();
  region.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    region.lineTo(point[0], point[1]);
  }

  if (closePath) {
    region.closePath();
  }
  ctx.stroke(region);
}

async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      'Browser API navigator.mediaDevices.getUserMedia not available');
  }

  video = document.getElementById('video');
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      // Only setting the video to a specified size in order to accommodate a
      // point cloud, so on mobile devices accept the default size.
      width: mobile ? undefined : VIDEO_WIDTH,
      height: mobile ? undefined : VIDEO_HEIGHT
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function loadVideo() {
  video = await setupCamera();
  video.play();
  return video;
}

async function frameLandmarks() {
  stats.begin();
  ctx.drawImage(video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width, canvas.height);
  const predictions = await model.estimateHands(video);
  if (predictions.length > 0) {
    const result = predictions[0].landmarks;
    drawKeypoints(ctx, result, predictions[0].annotations);

    if (renderPointcloud === true) {
      const pointsData = result.map(point => {
        return [-point[0], -point[1], -point[2]];
      });

    }
  }

  stats.end();
  requestAnimationFrame(frameLandmarks);
};


const main = async () => {
  model = await handpose.load();

  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = e.message;
    info.style.display = 'block';
    throw e;
  }

  landmarksRealTime(video);
}

const landmarksRealTime = async (video) => {
  setupDatGui();

  stats.showPanel(0);
  document.body.appendChild(stats.dom);

  videoWidth = video.videoWidth;
  videoHeight = video.videoHeight;

  canvas = document.getElementById('output');

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  ctx = canvas.getContext('2d');

  video.width = videoWidth;
  video.height = videoHeight;

  ctx.clearRect(0, 0, videoWidth, videoHeight);
  ctx.strokeStyle = "red";
  ctx.fillStyle = "red";

  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  frameLandmarks();

  initFingers();
  animate();

};

navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

main();

var container;
var camera, scene, renderer;
var fingerMesh;

function initFingers(){
  
  // container = document.createElement( 'div' );
  // document.body.appendChild( container );
  container = document.querySelector('#finger-gl-container');
  container.style = `width: ${videoWidth}px; height: ${videoHeight}px`;
  //container = document.getElementsByClassName('.glass-gl-container');
  
  var fov = 50;
  camera = new THREE.PerspectiveCamera( fov, videoWidth / videoHeight, 1, 3000 );
  camera.position.set( videoWidth/2, videoHeight/2, -videoHeight );

  //camera.target.set(videoWidth/2, videoHeight/2, 0)
  camera.lookAt(videoWidth/2, videoHeight/2, 0);
  //camera.lookAt(0, 0, 0);

  camera.updateMatrix();

  // controls = new OrbitControls( camera, container );
  // controls.target.set( videoWidth/2, videoHeight/2, 0 );
  // controls.update();

  console.log(videoWidth/2, videoHeight/2);
  scene = new THREE.Scene();
  
  renderer = new THREE.WebGLRenderer( { canvas: container, antialias: true, alpha: true } );
  renderer.setClearColor( 0x000000, 0 );
  //renderer.setPixelRatio( container.devicePixelRatio );
  renderer.setSize( videoWidth, videoHeight );
  renderer.gammaOutput = true;

  //window.addEventListener( 'resize', onWindowResize, false );

  const color = 0xFFFFFF;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(1, -2, -4);
  scene.add(light);

  const radius = 70;
  const widthSegments = 120;
  const heightSegments = 80;
  const spheregeometry = new THREE.SphereBufferGeometry(radius, widthSegments, heightSegments);

  const material = new THREE.MeshPhongMaterial({
    side: THREE.DoubleSide,
  });

  const hue = Math.random();
  const saturation = 1;
  const luminance = .5;
  material.color.setHSL(hue, saturation, luminance);

  var mesh = new THREE.Mesh(spheregeometry, material);

  mesh.position.x = videoWidth/2;
  mesh.position.y = videoHeight/2;

  scene.add(mesh);


  var MAX_POINTS = 500;

  // geometry
  var linegeometry = new THREE.BufferGeometry();

  // attributes
  var positions = new Float32Array( MAX_POINTS * 3 ); // 3 vertices per point
  linegeometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

  // draw range
  let drawCount = 2; // draw the first 2 points, only
  linegeometry.setDrawRange( 0, drawCount );

  // material
  var linematerial = new THREE.LineBasicMaterial( { color: 0xff0000 } );

  // line
  var line = new THREE.Line( linegeometry,  linematerial );
  scene.add( line );
  
}

//
function animate() {

  requestAnimationFrame( animate );
  renderer.render( scene, camera );

  stats.update();

}
