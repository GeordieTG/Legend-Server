import { createServer } from 'node:http'
import { createYoga } from 'graphql-yoga'
import { schema } from './schema.js'
import { Server } from 'socket.io'
import postgres from 'postgres'

const sql = postgres('postgresql://postgres:postgres@localhost:5432/postgres')

// GraphQL Server
const yoga = createYoga({ schema })
const server = createServer(yoga)
server.listen(4000, () => {
  console.info('Server is running on http://localhost:4000/graphql')
})

// Websockets Server
const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "prod" ? false : ["http://localhost:5173"]
  }
})

io.on('connection', (socket: any) => {

  console.log(`User ${socket.id} connected`)

  socket.on('enterRoom', (data: any) => {
    console.log("Joined" + data.room)
    socket.join(data.room)
  });

  socket.on("message", async (data: any) => {
    const time = new Intl.DateTimeFormat('default', {
      hour: 'numeric',
      minute: 'numeric'
    }).format(new Date())

    await sql`insert into message (name, text, time, room) values (${data.name}, ${data.text}, ${time}, ${data.room})`
    console.log("here")
    io.to(data.room).emit('message', buildMessage(data.name, data.text))
  })

  socket.on("activity", (data: any) => {
    socket.broadcast.to(data.room).emit('activity', data. name)
  })

})

httpServer.listen(3500, () => {
  console.info('Websocket server is running on port 3500')
})

const buildMessage = (name: string, text: string) => {
  return {
    name: name,
    text: text,
    time:  new Intl.DateTimeFormat('default', {
      hour: 'numeric',
      minute: 'numeric'
    }).format(new Date())
  }
}

