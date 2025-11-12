Attendance Management System - Backend API
A comprehensive backend for managing event attendance with QR code scanning, built with Node.js, Express, and MongoDB.

 Quick Start
Prerequisites

Node.js v14+
MongoDB Atlas account
Gmail account (for testing emails)

Installation
bash# 1. Clone and install
git clone <repository-url>
cd attendance-management-backend
npm install

# 2. Create uploads folder
mkdir uploads

# 3. Setup environment
cp .env.example .env
Environment Setup
Edit .env:
env# Server
NODE_ENV=development
PORT=5000

# MongoDB Atlas - Get from https://cloud.mongodb.com
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/attendance-management

# JWT Secret - Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_generated_secret_here
JWT_EXPIRE=7d

# Gmail (for testing)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password  # Get from Google Account > Security > App Passwords
EMAIL_FROM=NIHUB Team <your-email@gmail.com>

# Frontend
FRONTEND_URL=http://localhost:3000
Run
bashnpm run dev
Visit: http://localhost:5000/health

 API Endpoints
Base URL: http://localhost:5000/api
Authentication (No Token Required)
bash# Register Superadmin
POST /api/auth/register
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "password": "password123",
  "role": "superadmin"
}

# Login
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "password123"
}
# Returns: { token: "...", user: {...} }
# Save this token!
Events (Public)
bash# Get all events (no auth)
GET /api/events

# Get single event (no auth)
GET /api/events/:id
Events (Superadmin Only)
bash# Create event
POST /api/events
Headers: Authorization: Bearer <token>
{
  "name": "Event Name",
  "date": "2025-11-15T09:00:00Z",
  "location": "Venue",
  "description": "Description",
  "maxParticipants": 200,
  "imageUrl": "https://...",
  "tracks": [
    {
      "trackId": "1",
      "trackName": "Web Development",
      "trackAbbreviation": "WEB"
    }
  ]
}

# Update/Delete event
PUT /api/events/:id
DELETE /api/events/:id
Participants (Public Registration)
bash# Register participant (no auth, sends QR via email)
POST /api/participants/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "eventId": "event_id_here",
  "gender": "male",
  "department": "Computer Science",
  "matricNo": "CS/2020/001",
  "track": "WEB"
}

# With photo (multipart/form-data)
POST /api/participants/register
FormData: name, email, eventId, photo, etc.
Attendance (Admin/Superadmin)
bash# Scan QR code
POST /api/attendance/scan
Headers: Authorization: Bearer <token>
{
  "participantId": "id_from_qr_code"
}

# Get attendance report
GET /api/attendance/event/:eventId/report

 Frontend Integration
Field Name Compatibility
Backend accepts both formats (no changes needed):
javascript// Your current format works!
{
  eventname: "...",        // OR name: "..."
  fullname: "...",         // OR name: "..."
  matricnumber: "...",     // OR matricNo: "..."
  eventcapacity: 100       // OR maxParticipants: 100
}
Update Your Frontend URLs
javascript// Change from:
axios.post("BACKENDURL", data)

// To:
axios.post("http://localhost:5000/api/events", data, {
  headers: { Authorization: `Bearer ${token}` }
})
Store Token After Login
javascriptconst response = await axios.post('http://localhost:5000/api/auth/login', {
  email, password
});

// Save token
localStorage.setItem('token', response.data.data.token);

// Use in requests
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

 Testing
bash# Run all tests
npm test

# Test with Postman
1. Register superadmin
2. Login and copy token
3. Create event
4. Register participant (check email for QR)
5. Scan QR code
```

---

## 📁 Project Structure
```
attendance-management-backend/
├── config/          # Database connection
├── controllers/     # Business logic
├── models/          # Database schemas
├── routes/          # API endpoints
├── middleware/      # Auth, validation, error handling
├── utils/           # QR generation, email sending
├── tests/           # Test files
├── uploads/         # Uploaded photos
├── .env             # Environment variables
├── server.js        # Main entry point
└── package.json     # Dependencies

 Common Issues
MongoDB Connection Failed

Check MONGODB_URI in .env
Whitelist IP (0.0.0.0/0) in MongoDB Atlas

Email Not Sending

Use Gmail App Password (not regular password)
Enable 2-Step Verification first

JWT Token Invalid

Format: Authorization: Bearer <token>
Token expires after 7 days - login again

Port Already in Use
bash# Kill process
lsof -ti:5000 | xargs kill -9  # Mac/Linux
netstat -ano | findstr :5000   # Windows

 Deployment (Quick)
Heroku
bashheroku create app-name
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI="..."
heroku config:set JWT_SECRET="..."
heroku config:set EMAIL_HOST=smtp.gmail.com
heroku config:set EMAIL_USER="..."
heroku config:set EMAIL_PASSWORD="..."
git push heroku main
Render

Connect GitHub repo
Add environment variables
Deploy

 Complete Setup Checklist

 Node.js installed
 MongoDB Atlas setup
 .env configured
 npm install completed
 npm run dev running
 Health check passed
 Superadmin created
 Test event created
 Test registration done
 QR email received
 Frontend URLs updated
