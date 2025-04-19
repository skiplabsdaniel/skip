PROFILE?=release

lib%-example.so: examples/%/Skargo.toml
	mkdir -p build
	skargo build --profile $(PROFILE) --lib --manifest-path=$< --out-dir=./build

%-example: lib%-example.so server/Cargo.toml
	mkdir -p build
	SKIP_SERVICE=$@ \
	SKIP_SEARCH_PATH=$(CURDIR)/examples/$*/target/host/$(PROFILE) \
	cargo b --profile $(PROFILE) --manifest-path=server/Cargo.toml
	cp server/target/$(PROFILE)/skipruntime_server build/$@

clean-%: examples/%/Skargo.toml server/Cargo.toml
	skargo clean --manifest-path=examples/$*/Skargo.toml
	cargo clean --manifest-path=server/Cargo.toml
	rm -f build/lib$*-example.so build/$*-example

fmt-%: examples/%/Skargo.toml server/Cargo.toml
	skargo fmt --manifest-path=examples/$*/Skargo.toml
	cargo fmt --manifest-path=server/Cargo.toml

.PHONY: fmt-sk
fmt-sk:
	skargo fmt --manifest-path=core/Skargo.toml
	skargo fmt --manifest-path=ffi/Skargo.toml
	skargo fmt --manifest-path=services-ffi/Skargo.toml
