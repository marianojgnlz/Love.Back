import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { parse } from 'https://deno.land/std/flags/mod.ts';

const connectedClients = new Map();

const app = new Application();
const ip = "10.13.100.84";
const port = "1000";
const router = new Router();

const { args } = Deno;
const DEFAULT_PORT = 8000;
const argPort = parse(args).port;

// send a message to all connected clients
function broadcast(message) {
  for (const client of connectedClients.values()) {
    client.send(message);
  }
}

function broadcastTo(client, message) {
  connectedClients.get(client).send(message);
}


// send updated users list to all connected clients
function broadcast_usernames() {
  const usernames = [...connectedClients.keys()];
  console.log(
    "Sending updated username list to all clients: " +
      JSON.stringify(usernames),
  );
  if(usernames.length == 2) {
      broadcast(
        JSON.stringify({
          event: "start",
          usernames: usernames,
          player1: {
            userName: usernames[0],
            playWith: "X"
          },
          player2: {
            userName: usernames[1],
            playWith: "O"
          }
        }),
      );
    }
}

function set_user(username) {
  broadcastTo(
    username,
    JSON.stringify({
      event: "set-user",
      username: username
    })
  )
}

router.get("/start_web_socket", async (ctx) => {
  const socket = await ctx.upgrade();
  const username = ctx.request.url.searchParams.get("username");
  if (connectedClients.has(username)) {
    socket.close(1008, `Username ${username} is already taken`);
    return;
  }
  socket.username = username;
  connectedClients.set(username, socket);
  console.log(`New client connected: ${username}`);

  // broadcast the active users list when a new user logs in
  socket.onopen = () => {
    broadcast_usernames();
  };

  // when a client disconnects, remove them from the connected clients list
  // and broadcast the active users list
  socket.onclose = () => {
    console.log(`Client ${socket.username} disconnected`);
    connectedClients.delete(socket.username);
    broadcast_usernames();
  };

  // broadcast new message if someone sent one
  socket.onmessage = (m) => {
    const data = JSON.parse(m.data);
    switch (data.event) {
      case "send-message":
        broadcast(
          JSON.stringify({
            event: "send-message",
            username: socket.username,
            message: data.message,
          }),
        );
        break;
    }
  };
});

router.get("/tateti", async (ctx) => {
  const socket = await ctx.upgrade();
  const username = ctx.request.url.searchParams.get("username");
  if (connectedClients.has(username)) {
    socket.close(1008, `Username ${username} is already taken`);
    return;
  }
  socket.username = username;
  connectedClients.set(username, socket);
  console.log(`New client connected: ${username}`);

  // broadcast the active users list when a new user logs in
  socket.onopen = () => {
    broadcast_usernames();
    set_user(socket.username);
  };

  // when a client disconnects, remove them from the connected clients list
  // and broadcast the active users list
  socket.onclose = () => {
    console.log(`Client ${socket.username} disconnected`);
    connectedClients.delete(socket.username);
    broadcast_usernames();
  };

  // broadcast new message if someone sent one
  socket.onmessage = (m) => {
    const data = JSON.parse(m.data);
    switch (data.event) {
      case "send-message":
        broadcast(
          JSON.stringify({
            event: "send-message",
            username: socket.username,
            message: data.message,
          }),
        );
        break;
      case "click":
        broadcast(
          JSON.stringify({
            event: "click",
            element: data.element,
            username: socket.username,
          }),
        );
        break;
    }
  };
});

app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (context) => {
  await context.send({
    root: `${Deno.cwd()}/`,
    index: "public/index.html",
  });
});

console.log("Listening at http://localhost:" + argPort ? Number(argPort) : DEFAULT_PORT);
await app.listen(`${argPort ? Number(argPort) : DEFAULT_PORT}`);