package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	chatroom *Chatroom
	conn     *websocket.Conn
	id       int
	queue    chan []byte
}

func (client *Client) read() {
	defer func() {
		client.chatroom.kill <- client
		client.conn.Close()
	}()

	for {
		//NOTE: not using msg type
		_, msg, err := client.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Println("while reading message:", err)
			}
			break
		}
		client.chatroom.queue <-msg
	}
}

func (client *Client) write() {
	ticker := time.NewTicker(60 * time.Second)

	defer func() {
		ticker.Stop()
		client.chatroom.kill <-client
		client.conn.Close()
	}()

	for {
		select {
		case msg := <-client.queue:
			err := client.conn.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				log.Println("while writing message:", err)
				break
			}
		case <-ticker.C:
			//TODO: add keep-alive ping w/ client.conn.PingMessage
		}
	}
}

type Chatroom struct {
	clients map[*Client]bool
	queue   chan []byte
	kill    chan *Client
}

func (chatroom *Chatroom) introduce(conn *websocket.Conn) *Client {
	client := &Client{
		chatroom: chatroom,
		conn: conn,
		id: len(chatroom.clients),
		queue: make(chan []byte),
	}
	chatroom.clients[client] = true
	return client
}

func (chatroom *Chatroom) run() {
	for {
		select {
		case dead := <-chatroom.kill:
			delete(chatroom.clients, dead)
		case msg := <-chatroom.queue:
			for client := range chatroom.clients {
				client.queue <-msg
			}
		}
	}
}

func main() {
	// Run chatroom
	chatroom := &Chatroom{
		clients: make(map[*Client]bool),
		queue: make(chan []byte),
		kill: make(chan *Client),
	}
	go chatroom.run()

	// Configure websocket upgrader
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			return origin == "https://www.dominic-ricottone.com"
		},
	}

	// Handler for new connections
	http.HandleFunc("/chat", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("while upgrading connection:", err)
			return
		}

		client := chatroom.introduce(conn)
		go client.read()
		go client.write()
	})

	// Run server
	err := http.ListenAndServe(":40080", nil)
	if err != nil {
		log.Println("while running server:", err)
	}
}

