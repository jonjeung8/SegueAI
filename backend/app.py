import os
from flask import Flask, request, redirect, session, url_for, jsonify
from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyOAuth

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)  # For session management

# Configuration from environment variables
CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI')

# Set up the necessary scopes for your app
SCOPE = "playlist-read-private playlist-modify-private playlist-modify-public user-library-read"

# Initialize SpotifyOAuth from Spotipy
sp_oauth = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=SCOPE,
    cache_path=".cache"  # Cache token info to reuse until expiration
)

@app.route('/')
def index():
    return 'Welcome to SegueAI! <a href="/login">Login with Spotify</a>'

@app.route('/login')
def login():
    # Get the Spotify authorization URL and redirect the user
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@app.route('/callback')
def callback():
    # Spotify redirects here after authentication
    code = request.args.get('code')
    if not code:
        return "No code provided", 400

    token_info = sp_oauth.get_access_token(code, as_dict=True)
    session['token_info'] = token_info
    return redirect(url_for('get_user'))

@app.route('/get_user')
def get_user():
    # Retrieve the stored token and fetch the user's profile data from Spotify
    token_info = session.get('token_info', None)
    if not token_info:
        return redirect(url_for('login'))
    
    sp = spotipy.Spotify(auth=token_info['access_token'])
    user = sp.current_user()
    return jsonify(user)

if __name__ == '__main__':
    app.run(port=8888, debug=True)
