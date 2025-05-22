// Configuration
const API_KEY = 'AIzaSyDOWVJkL2nsvHq4svqY9uRBraQ1_Sc6V_Y';
const POLL_INTERVAL = 30000; // 30 seconds
const PREDICTION_MINUTES = 10;

// State
let viewHistory = [];
let trackingInterval = null;
let currentVideoId = null;
let chart = null;

// DOM Elements
const videoUrlInput = document.getElementById('video-url');
const analyzeBtn = document.getElementById('analyze-btn');
const stopBtn = document.getElementById('stop-btn');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const currentViewsEl = document.getElementById('current-views');
const viewRateEl = document.getElementById('view-rate');
const predictedViewsEl = document.getElementById('predicted-views');
const delayAdjustmentSelect = document.getElementById('delay-adjustment');

// Event Listeners
analyzeBtn.addEventListener('click', startAnalysis);
stopBtn.addEventListener('click', stopTracking);

async function startAnalysis() {
    const url = videoUrlInput.value.trim();
    const videoId = extractVideoId(url);
    
    if (!videoId) {
        showError('Please enter a valid YouTube URL');
        return;
    }
    
    currentVideoId = videoId;
    viewHistory = [];
    
    showLoading();
    hideError();
    
    try {
        await fetchVideoData(videoId);
        startTracking(videoId);
    } catch (error) {
        showError('Failed to fetch video data. Please try again.');
        console.error('Error:', error);
    }
}

function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function fetchVideoData(videoId) {
    try {
        const response = await axios.get(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${API_KEY}`
        );
        
        if (!response.data.items || response.data.items.length === 0) {
            throw new Error('Video not found');
        }
        
        const views = parseInt(response.data.items[0].statistics.viewCount);
        const timestamp = new Date();
        
        viewHistory.push({
            views: views,
            timestamp: timestamp
        });
        
        updateUI();
        hideLoading();
        showResults();
        
    } catch (error) {
        hideLoading();
        throw error;
    }
}

function startTracking(videoId) {
    // Clear any existing interval
    if (trackingInterval) {
        clearInterval(trackingInterval);
    }
    
    // Start new interval
    trackingInterval = setInterval(async () => {
        try {
            await fetchVideoData(videoId);
        } catch (error) {
            console.error('Tracking error:', error);
            // Continue tracking even if one request fails
        }
    }, POLL_INTERVAL);
}

function stopTracking() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
}

function updateUI() {
    if (viewHistory.length === 0) return;
    
    const current = viewHistory[viewHistory.length - 1];
    currentViewsEl.textContent = formatNumber(current.views);
    
    // Calculate view rate with delay compensation
    const delayFactor = parseFloat(delayAdjustmentSelect.value);
    let viewRate = 0;
    
    if (viewHistory.length > 1) {
        const timeDiff = (current.timestamp - viewHistory[0].timestamp) / (1000 * 60); // minutes
        const viewDiff = current.views - viewHistory[0].views;
        viewRate = (viewDiff / timeDiff) * delayFactor;
    }
    
    viewRateEl.innerHTML = `${formatNumber(viewRate.toFixed(2))} <span>views/min</span>`;
    
    // Predict future views
    const predictedViews = current.views + (viewRate * PREDICTION_MINUTES);
    predictedViewsEl.textContent = formatNumber(Math.round(predictedViews));
    
    // Update chart
    updateChart();
}

function updateChart() {
    const ctx = document.getElementById('view-chart').getContext('2d');
    
    // Prepare data
    const labels = viewHistory.map(entry => 
        entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const data = viewHistory.map(entry => entry.views);
    
    // Destroy previous chart if exists
    if (chart) {
        chart.destroy();
    }
    
    // Create new chart
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Views Over Time',
                data: data,
                borderColor: '#ff0000',
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                borderWidth: 2,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Views: ${formatNumber(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

function formatNumber(num) {
    return parseInt(num).toLocaleString();
}

function showLoading() {
    loadingDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    errorDiv.style.display = 'none';
}

function hideLoading() {
    loadingDiv.style.display = 'none';
}

function showResults() {
    resultsDiv.style.display = 'block';
}

function showError(message) {
    errorDiv.querySelector('p').textContent = message;
    errorDiv.style.display = 'block';
    loadingDiv.style.display = 'none';
    resultsDiv.style.display = 'none';
}

function hideError() {
    errorDiv.style.display = 'none';
}

// Initialize
delayAdjustmentSelect.addEventListener('change', () => {
    if (viewHistory.length > 0) {
        updateUI();
    }
});