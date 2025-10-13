# Nihub backend with Express MongoDB Boilerplate

A simple Node.js Express API with MongoDB integration and nodemon for development.

## Features

- Express.js web framework
- MongoDB database with Mongoose ODM
- Environment configuration with dotenv
- Nodemon for development auto-restart
- RESTful API routes for User resource
- Error handling middleware
- Input validation

## Project Structure

```
node-express-mongo-app/
├── config/
│   └── database.js          # MongoDB connection configuration
├── models/
│   └── User.js             # User model schema
├── routes/
│   └── users.js            # User API routes
├── middleware/             # Custom middleware (empty for now)
├── server.js               # Main application file
├── .env                    # Environment variables
├── .gitignore             # Git ignore rules
├── package.json           # Project dependencies and scripts
└── README.md              # This file
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB installed and running locally, or a MongoDB connection string

## Installation

1. Clone or navigate to the project directory:

   ```bash
   cd node-express-mongo-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create/update the `.env` file with your configuration:

   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/express-mongo-app
   NODE_ENV=development
   ```

4. Make sure MongoDB is running on your system

## Usage

### Development Mode (with nodemon)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your .env file).

## API Endpoints

### Base URL

- `GET /` - Welcome message with API information

### Users API

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user by ID
- `DELETE /api/users/:id` - Delete user by ID

### Example User Object

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30
}
```

## Testing the API

You can test the API using tools like Postman, curl, or any HTTP client.

### Create a new user:

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "age": 30}'
```

### Get all users:

```bash
curl http://localhost:3000/api/users
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV` - Environment mode (development/production)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC
