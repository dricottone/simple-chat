# Simple Chat

A simple chat server.

The only state for this server is the pooled connections.
Messages are not read or logged.
Completely agnostic to encrypted messages.


## Usage

Go to [www.dominic-ricottone.com/chat](https://www.dominic-ricottone.com/chat/)
to see it in action.

If trying to re-use and deploy this code, first change the hardcoded address in
`server/main.go` (line 103). Then try:

```
make server
```

This binary listens on port 8080 exposes a websocket,
which needs to be interfaced by a separate client.
See the `clients` directory for some ideas.


## Change Log

 + v1.0.1 - Updated dependencies
 + v1.0.0 - The imaginary tag, referring to all that came before tags


## License

I share the contents of this repository under the GPL 3 license.

