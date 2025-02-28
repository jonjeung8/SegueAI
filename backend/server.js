require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const SpotifyWebApi = require('spotify-web-api-node');

const app = express();
const PORT = process.env.PORT || 8888;

// Middleware for parsing cookies and managing sessions
app.use(cookieParser());
app.use(session({
  secret: 'your-session-secret',  // Use a fixed secret for development
  resave: false,
  saveUninitialized: true
}));

// Spotify credentials from environment variables
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

// Initialize the Spotify API wrapper
const spotifyApi = new SpotifyWebApi({
  clientId: clientId,
  clientSecret: clientSecret,
  redirectUri: redirectUri
});

// Helper function to generate a random state string
const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = 'spotify_auth_state';

// Base route
app.get('/', (req, res) => {
  res.send('Welcome to SegueAI! <a href="/login">Login with Spotify</a>');
});

// Login endpoint: redirects user to Spotify's authorization page
app.get('/login', (req, res) => {
    const state = generateRandomString(16);
    res.cookie(stateKey, state);
    const scopes = [
      'playlist-read-private',
      'playlist-modify-private',
      'playlist-modify-public',
      'user-library-read'
    ];
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
    res.redirect(authorizeURL);
  });
  

// Callback endpoint: handles the redirect from Spotify and obtains access tokens
app.get('/callback', (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (!state || state !== storedState) {
    res.redirect('/#' + new URLSearchParams({ error: 'state_mismatch' }).toString());
  } else {
    res.clearCookie(stateKey);
    spotifyApi.authorizationCodeGrant(code)
      .then(data => {
        const access_token = data.body['access_token'];
        const refresh_token = data.body['refresh_token'];
        
        // Set the access token and refresh token on the API object
        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);
        
        // Store tokens in session
        req.session.access_token = access_token;
        req.session.refresh_token = refresh_token;
        
        res.redirect('/get_user');
      })
      .catch(err => {
        console.error('Error getting tokens:', err);
        res.send('Error getting tokens');
      });
  }
});

// Endpoint to get user profile information
app.get('/get_user', (req, res) => {
  const token = req.session.access_token;
  if (!token) return res.redirect('/login');

  spotifyApi.setAccessToken(token);
  spotifyApi.getMe()
    .then(data => {
      res.json(data.body);
    })
    .catch(err => {
      console.error('Error fetching user:', err);
      res.send('Error fetching user info');
    });
});

// Endpoint to fetch track features (BPM, key, energy, etc.)
app.get('/track_features/:trackId', (req, res) => {
  const token = req.session.access_token;
  if (!token) return res.redirect('/login');

  spotifyApi.setAccessToken(token);
  const trackId = req.params.trackId;
  spotifyApi.getAudioFeaturesForTrack(trackId)
    .then(data => {
      res.json(data.body);
    })
    .catch(err => {
      console.error('Error fetching track features:', err);
      res.status(500).json({ error: "Error fetching track features", details: err });
    });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
