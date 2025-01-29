SRC=$(shell find -name '*.go')

clean:
	rm -f server go.mod go.sum

go.mod:
	go mod init git.sr.ht.com/~dricottone/simple-chat/server
	go get github.com/gorilla/websocket

server: go.mod $(SRC)
	go build

build: server

.PHONY: clean build
