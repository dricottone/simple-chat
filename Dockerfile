FROM golang:alpine

WORKDIR /app
COPY server/* ./
RUN go mod download
RUN go build -o /app/server-bin

EXPOSE 40080
RUN adduser -H -D -u 1001 me
USER me:me
CMD [ "/app/server-bin" ]

