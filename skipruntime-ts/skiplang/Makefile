SKARGO_PROFILE?=release
CARGO_DIR := $(if $(filter dev,$(SKARGO_PROFILE)),debug,$(SKARGO_PROFILE))

lib%-example.so: examples/%/Skargo.toml
	mkdir -p build/$(SKARGO_PROFILE)
	skargo build --profile $(SKARGO_PROFILE) --lib --manifest-path=$< --out-dir=./build/$(SKARGO_PROFILE)

%-example: lib%-example.so server/Cargo.toml
	mkdir -p build
	SKIP_SERVICE=$@ \
	SKIP_SEARCH_PATH=$(CURDIR)/build/$(SKARGO_PROFILE) \
	cargo b --profile $(SKARGO_PROFILE) --manifest-path=server/Cargo.toml
	cp server/target/$(CARGO_DIR)/skipruntime_server build/$(SKARGO_PROFILE)/$@

clean-%-sk: examples/%/Skargo.toml
	skargo clean --manifest-path=examples/$*/Skargo.toml

clean-rs: server/Cargo.toml
	cargo clean --manifest-path=server/Cargo.toml

clean-%-build: examples/%/Skargo.toml
	rm -f build/$(SKARGO_PROFILE)/lib$*-example.so build/$(SKARGO_PROFILE)/$*-example

clean-%: clean-%-sk clean-rs clean-%-build

fmt-%: examples/%/Skargo.toml server/Cargo.toml
	skargo fmt --manifest-path=examples/$*/Skargo.toml
	cargo fmt --manifest-path=server/Cargo.toml

.PHONY: fmt-rs
fmt-rs:
	cargo fmt --manifest-path=server/Cargo.toml

.PHONY: fmt-sk
fmt-sk:
	skargo fmt --manifest-path=core/Skargo.toml
	skargo fmt --manifest-path=ffi/Skargo.toml
	skargo fmt --manifest-path=services-ffi/Skargo.toml