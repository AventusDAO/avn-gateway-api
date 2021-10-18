version=latest

package: clean build
ifndef version
	$(info Version unspecified. Using default "latest")
endif
ifndef name
	$(error lambda function name must be supplied)
endif
	mkdir -p build/$(name)
	cd $(name) && zip -r ../build/$(name)/$(name)-$(version) ./

build:
ifndef name
	$(error lambda function name must be supplied)
endif
	npm --prefix ./$(name) install ./$(name)

clean:
	rm -rf ./build/