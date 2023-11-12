clean:
	rm -f server
	rm -f go.mod

go.mod:
	go mod init git.dominic-ricottone.com/~dricottone/simple-chat/server
	go get github.com/gorilla/websocket

server:
	go mod download
	go build

build: server

.PHONY: clean build
