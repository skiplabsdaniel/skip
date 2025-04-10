

SOURCES_DIR=src/main/cpp


SOURCES=$(shell find '$(SOURCES_DIR)' -type f -name '*.c')

LIBRARY=target/classes/libskiplinks.so

all: $(LIBRARY)

$(LIBRARY): $(SOURCES)
	mkdir -p $(shell dirname $(LIBRARY))
	$(CC) -shared -o $@ -I"$(JAVA_HOME)/include" -I"$(JAVA_HOME)/include/linux" $(SOURCES)

.PHONY: clean
clean:
	rm $(LIBRARY)