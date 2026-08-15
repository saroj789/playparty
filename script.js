let player;
let isPlaying = false;
let progressInterval = null;
const STORAGE_PLAYLIST_KEY = 'playparty_playlist_url';

const DEFAULT_PLAYLIST_URL = 'https://music.youtube.com/playlist?list=RDCLAK5uy_lnm4v4arFrmL63NUzIdoXJe-E7G4_sriU';

function onYouTubeIframeAPIReady() {
  player = new YT.Player('yt-player', {
    height: '0', 
    width: '0',
    playerVars: { 
      autoplay: 1, 
      controls: 0, 
      rel: 0, 
      modestbranding: 1 
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
    }
  });
}

function onPlayerReady() {
  setupEventListeners();
  autoLoadSavedPlaylist();
}

function onPlayerError(event) {
  console.warn("YouTube playback restriction encountered, skipping track:", event.data);
  setTimeout(() => {
    if (player && typeof player.nextVideo === 'function') {
      player.nextVideo();
    }
  }, 500);
}

function extractPlaylistId(input) {
  if (!input) return null;
  input = input.trim();

  if (!input.includes('http') && !input.includes('youtube.com')) {
    return input;
  }
  
  try {
    const urlObj = new URL(input);
    const listParam = urlObj.searchParams.get('list');
    if (listParam) return listParam;
  } catch (e) {}

  const regExp = /[?&]list=([^#\&\?]+)/;
  const match = input.match(regExp);
  return (match && match[1]) ? match[1] : input;
}

function loadPlaylistFromUrl(playlistUrl) {
  const playlistId = extractPlaylistId(playlistUrl);
  if (playlistId) {
    player.loadPlaylist({ 
      listType: 'playlist', 
      list: playlistId, 
      index: 0 
    });
    localStorage.setItem(STORAGE_PLAYLIST_KEY, playlistUrl);
  } else {
    console.error("Could not parse a valid playlist ID from the input.");
  }
}

function autoLoadSavedPlaylist() {
  const savedUrl = localStorage.getItem(STORAGE_PLAYLIST_KEY);
  const targetUrl = savedUrl || DEFAULT_PLAYLIST_URL;
  document.getElementById('playlist-url-input').value = targetUrl;
  loadPlaylistFromUrl(targetUrl);
}

function onPlayerStateChange(event) {
  const playIcon = document.getElementById('play-icon');
  
  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    playIcon.innerText = 'pause';
    startProgressTimer();
    updateTrackInfo();
  } else if (event.data === YT.PlayerState.BUFFERING) {
    document.getElementById('track-title').innerText = "Loading track...";
    document.getElementById('track-artist').innerText = "Please wait...";
  } else {
    isPlaying = false;
    playIcon.innerText = 'play_arrow';
    if (event.data !== YT.PlayerState.CUED) {
      stopProgressTimer();
    }
  }
}

function updateTrackInfo() {
  if (!player || typeof player.getVideoData !== 'function') return;
  const ytData = player.getVideoData();
  if (!ytData.title) return;
  
  document.getElementById('track-title').innerText = ytData.title;
  document.getElementById('track-artist').innerText = ytData.author || "YouTube Music";
  
  const videoId = ytData.video_id;
  if (videoId) {
    updateBackground(videoId);
  }
}

function updateBackground(videoId) {
  const bgElement = document.getElementById('bg-anime');
  const highResUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const medResUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const img = new Image();
  img.onload = () => bgElement.style.backgroundImage = `url('${highResUrl}')`;
  img.onerror = () => bgElement.style.backgroundImage = `url('${medResUrl}')`;
  img.src = highResUrl;
}

function handleSeek(e) {
  const container = document.getElementById('progress-container');
  const rect = container.getBoundingClientRect();
  const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  const duration = player.getDuration() || 0;
  if (duration > 0) {
    player.seekTo(duration * pct, true);
  }
}

function setupEventListeners() {
  const loadBtn = document.getElementById('load-playlist-btn');
  const urlInput = document.getElementById('playlist-url-input');

  loadBtn.addEventListener('click', () => {
    loadPlaylistFromUrl(urlInput.value.trim());
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadBtn.click();
  });
  
  document.getElementById('btn-play-pause').addEventListener('click', () => {
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  });
  
  document.getElementById('btn-next').addEventListener('click', () => player.nextVideo());
  document.getElementById('btn-prev').addEventListener('click', () => player.previousVideo());

  // Mute Button Handler
  document.getElementById('btn-mute').addEventListener('click', () => {
    const muteIcon = document.getElementById('mute-icon');
    if (player.isMuted()) {
      player.unMute();
      muteIcon.innerText = 'volume_up';
    } else {
      player.mute();
      muteIcon.innerText = 'volume_off';
    }
  });

  // Responsive progress bar click & touch interactions
  const progressContainer = document.getElementById('progress-container');
  progressContainer.addEventListener('click', handleSeek);
  progressContainer.addEventListener('touchstart', (e) => {
    handleSeek(e);
    e.preventDefault();
  }, { passive: false });
}

function startProgressTimer() {
  stopProgressTimer();
  progressInterval = setInterval(() => {
    if (!player || !player.getCurrentTime) return;
    const current = player.getCurrentTime() || 0;
    const duration = player.getDuration() || 0;
    document.getElementById('time-current').innerText = formatTime(current);
    document.getElementById('time-total').innerText = formatTime(duration);
    document.getElementById('progress-played').style.width = duration > 0 ? `${(current / duration) * 100}%` : '0%';
  }, 250);
}

function stopProgressTimer() { 
  if (progressInterval) clearInterval(progressInterval); 
}

function formatTime(s) { 
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2, '0')}`; 
}
