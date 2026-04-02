# StreamIt Backend

A robust backend API for a video streaming platform similar to YouTube, built with Node.js, Express, and MongoDB.

## Features

- **User Management**: Registration, authentication, profile management with avatar and cover images
- **Video Management**: Upload, publish, update, delete videos with thumbnail support
- **Subscription System**: Subscribe/unsubscribe to channels
- **Playlist Management**: Create, update, delete playlists and manage videos within them
- **Comments**: Add, update, delete comments on videos
- **Likes**: Like/unlike videos, comments, and tweets
- **Tweets**: Create, update, delete tweets (community posts)
- **Dashboard**: Channel statistics and video analytics
- **Watch History**: Track user's video watch history

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Cloud Storage**: Cloudinary (for images and videos)
- **Password Hashing**: bcrypt

## Prerequisites

Before running this project, make sure you have:

- Node.js (v18 or higher recommended)
- MongoDB instance (local or cloud like MongoDB Atlas)
- Cloudinary account for media storage

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=8000
   MONGODB_URI=your_mongodb_connection_string
   CORS_ORIGIN=http://localhost:5173
   
   ACCESS_TOKEN_SECRET=your_access_token_secret
   ACCESS_TOKEN_EXPIRY=1d
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   REFRESH_TOKEN_EXPIRY=10d
   
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:8000`

## API Endpoints

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/healthcheck` | Check API health status |

### Users
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/users/register` | Register a new user | No |
| POST | `/api/v1/users/login` | Login user | No |
| POST | `/api/v1/users/logout` | Logout user | Yes |
| POST | `/api/v1/users/refreshUser` | Refresh access token | Yes |
| POST | `/api/v1/users/changePassword` | Change password | Yes |
| POST | `/api/v1/users/getCurrentUser` | Get current user details | Yes |
| PATCH | `/api/v1/users/updateUserDetails` | Update user details | Yes |
| PATCH | `/api/v1/users/updateAvatar` | Update user avatar | Yes |
| PATCH | `/api/v1/users/updateUserCoverImage` | Update cover image | Yes |
| GET | `/api/v1/users/channel/:username` | Get channel profile | Yes |
| GET | `/api/v1/users/getWatchHistory` | Get watch history | Yes |

### Videos
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/videos/getAllVideos` | Get all videos | Yes |
| POST | `/api/v1/videos/publishAVideo` | Upload and publish a video | Yes |
| GET | `/api/v1/videos/video/:videoId` | Get video by ID | Yes |
| PATCH | `/api/v1/videos/video/:videoId` | Update video | Yes |
| DELETE | `/api/v1/videos/video/:videoId` | Delete video | Yes |
| PATCH | `/api/v1/videos/toggle/publish/:videoId` | Toggle publish status | Yes |

### Subscriptions
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/subscriptions/c/:channelId` | Get subscribed channels | Yes |
| POST | `/api/v1/subscriptions/c/:channelId` | Toggle subscription | Yes |
| GET | `/api/v1/subscriptions/u/:subscriberId` | Get channel subscribers | Yes |

### Playlists
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/playlists/` | Create a playlist | Yes |
| GET | `/api/v1/playlists/:playlistId` | Get playlist by ID | Yes |
| PATCH | `/api/v1/playlists/:playlistId` | Update playlist | Yes |
| DELETE | `/api/v1/playlists/:playlistId` | Delete playlist | Yes |
| PATCH | `/api/v1/playlists/add/:videoId/:playlistId` | Add video to playlist | Yes |
| PATCH | `/api/v1/playlists/remove/:videoId/:playlistId` | Remove video from playlist | Yes |
| GET | `/api/v1/playlists/user/:userId` | Get user's playlists | Yes |

### Comments
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/comments/:videoId` | Get video comments | Yes |
| POST | `/api/v1/comments/:videoId` | Add comment | Yes |
| PATCH | `/api/v1/comments/c/:commentId` | Update comment | Yes |
| DELETE | `/api/v1/comments/c/:commentId` | Delete comment | Yes |

### Likes
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/likes/toggle/v/:videoId` | Toggle video like | Yes |
| POST | `/api/v1/likes/toggle/c/:commentId` | Toggle comment like | Yes |
| POST | `/api/v1/likes/toggle/t/:tweetId` | Toggle tweet like | Yes |
| GET | `/api/v1/likes/videos` | Get liked videos | Yes |

### Tweets
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/tweets/` | Create a tweet | Yes |
| GET | `/api/v1/tweets/user/:userId` | Get user tweets | Yes |
| PATCH | `/api/v1/tweets/:tweetId` | Update tweet | Yes |
| DELETE | `/api/v1/tweets/:tweetId` | Delete tweet | Yes |

### Dashboard
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/dashboard/stats` | Get channel stats | Yes |
| GET | `/api/v1/dashboard/videos` | Get channel videos | Yes |

## Project Structure

```
src/
├── app.js              # Express app configuration
├── index.js            # Entry point
├── constant.js         # Application constants
├── controllers/        # Request handlers
├── db/                 # Database connection
├── middlewares/        # Custom middlewares (auth, file upload)
├── models/             # Mongoose schemas
├── routes/             # API routes
└── utils/              # Utility functions (ApiError, ApiResponse, etc.)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with nodemon |
| `npm test` | Run tests |

## Data Models

### User
- username, email, fullName, avatar, coverImage
- password (hashed), refreshToken
- watchHistory (references to videos)

### Video
- videoFile, thumbnail, title, description
- duration, views, isPublished
- owner (reference to user)

### Playlist
- name, description, videos, owner

### Comment
- content, video, owner

### Like
- video/comment/tweet, likedBy

### Tweet
- content, owner

### Subscription
- subscriber, channel

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
