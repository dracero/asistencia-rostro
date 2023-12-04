
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

import { registerSW } from 'virtual:pwa-register';

import { MongoClient } from "mongodb";

const uri = "mongodb+srv://mcollazo:tcWxESvIvTNjvoiV@cluster0.zf9fl.mongodb.net/?retryWrites=true&w=majority"

// Constants
const filesetResolverBasePath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm';
const faceDetectorModelAssetPath = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const faceDetectorDelegate = 'GPU';
const faceDetectorRunningMode = 'VIDEO';

// Elements
const detectorSection = document.getElementById('detector');
const video = document.getElementById('webcam');
const liveView = document.getElementById('liveView');
const enableWebcamButton = document.getElementById('webcamButton');
const captureButton = document.getElementById('captureButton');
const canvas = document.getElementById('myCanvas');

// Variables
let faceDetector = null;
let children = [];
let lastVideoTime = -1;

let cachedMongo;

const connectToDB = async () => {
  const mongo = await new MongoClient(uri, {}).connect();
  return mongo.db("auto-asistencia");
};

export const Alumnos = async () => {
  const db = await connectToDB();
  console.log("db: ", db);
  return db.collection("alumnos");
};

export const addAlumno = async (newAlumno) => {
    const alumno = await (await Alumnos()).insertOne(newAlumno);
    return alumno;
};

const initializeFaceDetector = async () => {
    const vision = await FilesetResolver.forVisionTasks(filesetResolverBasePath);
    faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: faceDetectorModelAssetPath, delegate: faceDetectorDelegate },
        runningMode: faceDetectorRunningMode
    });
    detectorSection.classList.remove('invisible');
    enableWebcamButton.addEventListener('click', enableCam);
    captureButton.addEventListener('click', capture);
};

const enableCam = async(event) => {
    if (!faceDetector) {
        alert('Face Detector is still loading. Please try again..');
        return;
    }
    enableWebcamButton.classList.add('removed');
    const constraints = { video: true };
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function (stream) { video.srcObject = stream; video.addEventListener('loadeddata', predictWebcam); })
        .catch((err) => { console.error(err); });
}

const predictWebcam = async() => {
    let startTimeMs = performance.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const detections = faceDetector.detectForVideo(video, startTimeMs)
            .detections;
        if (detections.length == 1)
            captureButton.disabled = false;
        else
            captureButton.disabled = true;
        displayVideoDetections(detections);
    }
    window.requestAnimationFrame(predictWebcam);
}

const displayVideoDetections = async(detections) => {
    for (let child of children)
        liveView.removeChild(child);
    children.splice(0);
    for (let detection of detections) {
        const p = document.createElement('p');
        p.innerText =
            'Confidence: ' + Math.round(parseFloat(detection.categories[0].score) * 100) + '% .';
        p.style =
            'left: ' + (video.offsetWidth - detection.boundingBox.width - detection.boundingBox.originX) + 'px;' +
            'top: ' + (detection.boundingBox.originY - 30) + 'px; ' +
            'width: ' + (detection.boundingBox.width - 10) + 'px;';
        const highlighter = document.createElement('div');
        highlighter.setAttribute('class', 'highlighter');
        highlighter.style =
            'left: ' + (video.offsetWidth - detection.boundingBox.width - detection.boundingBox.originX) + 'px;' +
            'top: ' + detection.boundingBox.originY + 'px;' +
            'width: ' + (detection.boundingBox.width - 10) + 'px;' +
            'height: ' + detection.boundingBox.height + 'px;';
        liveView.appendChild(highlighter);
        liveView.appendChild(p);
        children.push(highlighter);
        children.push(p);
        for (let keypoint of detection.keypoints) {
            const keypointEl = document.createElement('spam');
            keypointEl.className = 'key-point';
            keypointEl.style.top = `${keypoint.y * video.offsetHeight - 3}px`;
            keypointEl.style.left = `${video.offsetWidth - keypoint.x * video.offsetWidth - 3}px`;
            liveView.appendChild(keypointEl);
            children.push(keypointEl);
        }
    }
}

const capture = () => {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataURL = canvas.toDataURL();
    const img = document.createElement('img');
    img.src = dataURL;
    const data = { image: img, date: new Date() }
    console.log(data);
    addAlumno({ name: "Name_Test", image: img, date: new Date() });
}

const updateSW = registerSW({
	onNeedRefresh() {},
	onOfflineReady() {
		console.log('Offline ready');
	},
});


initializeFaceDetector();
updateSW();
