let player;
let isPlaying = false;
let progressInterval = null;
let isDraggingProgress = false;
const STORAGE_PLAYLIST_KEY = 'playparty_playlist_url';

const DEFAULT_PLAYLIST_URL = 'https://www.youtube.com/watch?v=TwFBtV13KQQ&list=PLktzVu3BNrn4pnOLxO9s3wCvTTYEQQHbz';

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
  if (player && typeof player.setVolume === 'function') {
    player.setVolume(100);
  }
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
  } catch (e) { }

  const regExp = /[?&]list=([^#\&\?]+)/;
  const match = input.match(regExp);
  return (match && match[1]) ? match[1] : input;
}

function loadPlaylistFromUrl(playlistUrl) {
  if (!playlistUrl || typeof playlistUrl !== 'string' || !playlistUrl.trim()) {
    return;
  }

  const playlistId = extractPlaylistId(playlistUrl);
  if (playlistId) {
    // Clear the current queue so YouTube forces the new playlist on the first click
    if (player && typeof player.stopVideo === 'function') {
      player.stopVideo();
    }

    player.loadPlaylist({
      listType: 'playlist',
      list: playlistId,
      index: 0
    });
    localStorage.setItem(STORAGE_PLAYLIST_KEY, playlistUrl);

    // Force immediate playback on the first click
    setTimeout(() => {
      if (player && typeof player.playVideo === 'function') {
        player.playVideo();
      }
    }, 300);
  } else {
    console.error("Could not parse a valid playlist ID from the input.");
  }
}

function autoLoadSavedPlaylist() {
  const savedUrl = localStorage.getItem(STORAGE_PLAYLIST_KEY);
  const targetUrl = savedUrl || DEFAULT_PLAYLIST_URL;
  const inputEl = document.getElementById('playlist-url-input');
  if (inputEl) {
    inputEl.value = targetUrl;
  }
  loadPlaylistFromUrl(targetUrl);
  updateLoadButtonState();
}

function updateLoadButtonState() {
  const urlInput = document.getElementById('playlist-url-input');
  const loadBtn = document.getElementById('load-playlist-btn');
  if (!urlInput || !loadBtn) return;

  if (!urlInput.value.trim()) {
    loadBtn.disabled = true;
  } else {
    loadBtn.disabled = false;
  }
}

function onPlayerStateChange(event) {
  const playIcon = document.getElementById('play-icon');

  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    playIcon.innerText = 'pause';
    startProgressTimer();
    updateTrackInfo();
  } else if (event.data === YT.PlayerState.CUED) {
    updateTrackInfo();
    player.playVideo();
  } else if (event.data === YT.PlayerState.UNSTARTED) {
    updateTrackInfo();
  } else if (event.data === YT.PlayerState.BUFFERING) {
    // Left empty intentionally to prevent flickering text during seeks/buffering
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

function updateVolumeIcon(vol) {
  const muteIcon = document.getElementById('mute-icon');
  if (vol == 0) {
    muteIcon.innerText = 'volume_off';
  } else if (vol < 50) {
    muteIcon.innerText = 'volume_down';
  } else {
    muteIcon.innerText = 'volume_up';
  }
}

function setupEventListeners() {
  const loadBtn = document.getElementById('load-playlist-btn');
  const urlInput = document.getElementById('playlist-url-input');
  const clearBtn = document.getElementById('clear-input-btn');
  const volumeSlider = document.getElementById('volume-slider');
  const volumePill = document.getElementById('volume-pill-container');
  const muteIcon = document.getElementById('mute-icon');

  // Monitor input text changes to dynamically enable/disable the load button
  urlInput.addEventListener('input', () => {
    updateLoadButtonState();
  });

  loadBtn.addEventListener('click', () => {
    loadPlaylistFromUrl(urlInput.value.trim());
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    updateLoadButtonState();
    urlInput.focus();
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && urlInput.value.trim()) loadBtn.click();
  });

  document.getElementById('btn-play-pause').addEventListener('click', () => {
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    player.nextVideo();
    setTimeout(() => { player.playVideo(); }, 300);
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    player.previousVideo();
    setTimeout(() => { player.playVideo(); }, 300);
  });

  document.getElementById('btn-reload').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_PLAYLIST_KEY);
    urlInput.value = DEFAULT_PLAYLIST_URL;
    updateLoadButtonState();
    loadPlaylistFromUrl(DEFAULT_PLAYLIST_URL);
  });

  // Volume slider input handler
  volumeSlider.addEventListener('input', (e) => {
    const vol = e.target.value;
    if (player && typeof player.setVolume === 'function') {
      player.setVolume(vol);
      if (vol > 0 && player.isMuted()) {
        player.unMute();
      }
    }
    updateVolumeIcon(vol);
  });

  // Click anywhere inside the volume pill to adjust volume
  if (volumePill) {
    volumePill.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
      const rect = volumeSlider.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      let percentage = Math.min(Math.max(clickX / width, 0), 1);
      let newVol = Math.round(percentage * 100);
      volumeSlider.value = newVol;
      if (player && typeof player.setVolume === 'function') {
        player.setVolume(newVol);
        if (newVol > 0 && player.isMuted()) {
          player.unMute();
        }
      }
      updateVolumeIcon(newVol);
    });
  }

  // Mute Button Handler
  document.getElementById('btn-mute').addEventListener('click', () => {
    if (!player) return;
    if (player.isMuted()) {
      player.unMute();
      const currentVol = player.getVolume();
      volumeSlider.value = currentVol;
      updateVolumeIcon(currentVol);
    } else {
      player.mute();
      volumeSlider.value = 0;
      muteIcon.innerText = 'volume_off';
    }
  });

  // Smooth Interactive Progress Bar Scrubbing / Dragging Handler
  const progressContainer = document.getElementById('progress-container');

  function getProgressPercentage(e) {
    const rect = progressContainer.getBoundingClientRect();
    const clientX = e.clientX
      || (e.touches && e.touches[0] ? e.touches[0].clientX : 0)
      || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  }

  function onProgressStart(e) {
    if (!player || typeof player.getDuration !== 'function') return;
    isDraggingProgress = true;
    stopProgressTimer();

    const pct = getProgressPercentage(e);
    document.getElementById('progress-played').style.width = `${pct * 100}%`;

    const duration = player.getDuration() || 0;
    if (duration > 0) {
      document.getElementById('time-current').innerText = formatTime(duration * pct);
    }

    if (e.type === 'touchstart') e.preventDefault();
  }

  function onProgressMove(e) {
    if (!isDraggingProgress) return;
    const pct = getProgressPercentage(e);
    document.getElementById('progress-played').style.width = `${pct * 100}%`;

    const duration = player.getDuration() || 0;
    if (duration > 0) {
      document.getElementById('time-current').innerText = formatTime(duration * pct);
    }
  }

  function onProgressEnd(e) {
    if (!isDraggingProgress) return;
    isDraggingProgress = false;

    const pct = getProgressPercentage(e);
    const duration = player.getDuration() || 0;
    if (duration > 0) {
      player.seekTo(duration * pct, true);

      if (!isPlaying) {
        player.pauseVideo();
      }
    }

    if (isPlaying) {
      startProgressTimer();
    }
  }

  progressContainer.addEventListener('mousedown', onProgressStart);
  document.addEventListener('mousemove', onProgressMove);
  document.addEventListener('mouseup', onProgressEnd);

  progressContainer.addEventListener('touchstart', onProgressStart, { passive: false });
  document.addEventListener('touchmove', onProgressMove, { passive: false });
  document.addEventListener('touchend', onProgressEnd);
}

function startProgressTimer() {
  stopProgressTimer();
  progressInterval = setInterval(() => {
    if (isDraggingProgress || !player || !player.getCurrentTime) return;
    const current = player.getCurrentTime() || 0;
    const duration = player.getDuration() || 0;
    document.getElementById('time-current').innerText = formatTime(current);
    document.getElementById('time-total').innerText = formatTime(duration);
    document.getElementById('progress-played').style.width = duration > 0 ? `${(current / duration) * 100}%` : '0%';
  }, 50);
}

function stopProgressTimer() {
  if (progressInterval) clearInterval(progressInterval);
}

function formatTime(s) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}