const socket = io();

const call = document.getElementById(`call`);
const myFace = document.getElementById(`myFace`);
const muteBtn = document.getElementById(`mute`);
const cameraBtn = document.getElementById(`camera`);
const camerasSelect = document.getElementById(`cameras`);
const chat = document.getElementById(`chat`);
const chatList = document.getElementById(`chatList`);
const chatForm = document.getElementById(`chatForm`);

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let dataChannel;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === `videoinput`);
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement(`option`);
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstrains = {
    audio: true,
    video: { facingMode: `user` },
  };
  const cameraConstrains = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstrains : initialConstrains
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  console.log(
    myStream
      .getAudioTracks()
      .forEach((track) => (track.enabled = !track.enabled))
  );
  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}

function handleCameraClick() {
  console.log(
    myStream
      .getVideoTracks()
      .forEach((track) => (track.enabled = !track.enabled))
  );
  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === `video`);
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener(`click`, handleMuteClick);
cameraBtn.addEventListener(`click`, handleCameraClick);
camerasSelect.addEventListener(`input`, handleCameraChange);

// Welcome Form (join a room)
const welcome = document.getElementById(`welcome`);
const welcomeForm = welcome.querySelector(`form`);

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(e) {
  e.preventDefault();
  const input = welcomeForm.querySelector(`input`);
  await initCall();
  socket.emit(`join_room`, input.value);
  roomName = input.value;
  input.value = ``;
}

welcomeForm.addEventListener(`submit`, handleWelcomeSubmit);

// Chat
function handleChatSubmit(e) {
  e.preventDefault();
  const input = chatForm.querySelector("input");
  const message = input.value;
  const span = document.createElement("span");
  span.innerText = message;
  span.className = "myMessage";
  chatList.appendChild(span);
  input.value = "";
  chatList.scrollTop = chatList.scrollHeight;
  dataChannel.send(message);
}

function handleRecievedMessage(message) {
  const span = document.createElement("span");
  span.innerText = message;
  span.className = "othersMessage";
  chatList.appendChild(span);
  chatList.scrollTop = chatList.scrollHeight;
}

chatForm.addEventListener(`submit`, handleChatSubmit);

// Socket Code

socket.on(`welcome`, async () => {
  dataChannel = myPeerConnection.createDataChannel(`chat`);
  dataChannel.addEventListener(`message`, (e) => {
    handleRecievedMessage(e.data);
  });
  console.log(`made data channel`);
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  socket.emit(`offer`, offer, roomName);
  console.log(`sent the offer`);
});

socket.on(`offer`, async (offer) => {
  myPeerConnection.addEventListener(`datachannel`, (e) => {
    dataChannel = e.channel;
    dataChannel.addEventListener(`message`, (e) => {
      handleRecievedMessage(e.data);
    });
  });
  console.log(`received the offer`);
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit(`answer`, answer, roomName);
  console.log(`sent the answer`);
});

socket.on(`answer`, (answer) => {
  console.log(`received the answer`);
  myPeerConnection.setRemoteDescription(answer);
});

socket.on(`ice`, (ice) => {
  console.log(`received candidate`);
  myPeerConnection.addIceCandidate(ice);
});

// Rtc Code
function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: ["stun:ntk-turn-2.xirsys.com"],
      },
      {
        username:
          "0Vn4o6oJ1QqKcYaF6nXjyZwwlZW4_jOA45-cvykbAjI_gaewDKvhnMgptpcqz48LAAAAAGTdzwRramgwMzI=",
        credential: "6461939e-3cd1-11ee-ac82-0242ac120004",
        urls: [
          "turn:ntk-turn-2.xirsys.com:80?transport=udp",
          "turn:ntk-turn-2.xirsys.com:3478?transport=udp",
          "turn:ntk-turn-2.xirsys.com:80?transport=tcp",
          "turn:ntk-turn-2.xirsys.com:3478?transport=tcp",
          "turns:ntk-turn-2.xirsys.com:443?transport=tcp",
          "turns:ntk-turn-2.xirsys.com:5349?transport=tcp",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener(`icecandidate`, handleIce);
  myPeerConnection.addEventListener(`track`, handleTrack);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log(`sent candidate`);
  socket.emit(`ice`, data.candidate, roomName);
}
function handleTrack(data) {
  console.log(`handleTrack`);

  const peerFace = document.getElementById(`peerFace`);
  peerFace.srcObject = data.streams[0];
}
