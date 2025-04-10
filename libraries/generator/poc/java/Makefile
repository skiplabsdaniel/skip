
LIBFILE=$(shell find ./target/host/dev/deps -type f -regex './target/host/dev/deps/libjava-poc-[0-9a-f]+.sklib')

.PHONY: build
build:
	cd library && mvn package
	skargo b

.PHONY: run
run:
	@LD_LIBRARY_PATH=$(JAVA_HOME)/lib:$(JAVA_HOME)/lib/server target/host/dev/javapoc

../../target/host/dev/skgen:
	cd .. && skargo b

.PHONY: generate
generate: ../../target/host/dev/skgen
	../../target/host/dev/skgen -l java-poc=$(LIBFILE) -L ./target/host/dev/deps

.PHONY: clean
clean:
	cd library && mvn clean
	skargo clean

.PHONY: rebuild
rebuild: clean build