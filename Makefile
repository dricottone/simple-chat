CONMAN=sudo docker

.PHONY: clean
clean:
	$(CONMAN) image rm --force my-chat || true


.PHONY: image
image:
	#cd server && make build
	$(CONMAN) build --tag my-chat .


