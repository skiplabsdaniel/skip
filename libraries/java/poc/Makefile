

target/host/lib/libmylibrary.so:
	mkdir -p target/host/lib
	clang -shared -o target/host/lib/libmylibrary.so -I"$(JAVA_HOME)/include" -I"$(JAVA_HOME)/include/linux" extern/library.c

.PHONY: build
build: target/host/lib/libmylibrary.so
	cd java/library && mvn package
	skargo b


.PHONY: run
run:
	@LD_LIBRARY_PATH=$(JAVA_HOME)/lib:$(JAVA_HOME)/lib/server:$(CURDIR)/target/host/lib target/host/dev/javapoc


.PHONY: clean
clean:
	cd java/library && mvn clean
	skargo clean

.PHONY: rebuild
rebuild: clean build