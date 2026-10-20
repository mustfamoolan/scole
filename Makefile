.PHONY: build run clean

BINARY_NAME=institute

build:
	go build -o bin/$(BINARY_NAME) main.go

run:
	go run main.go

clean:
	rm -rf bin/
	go clean
