version=latest

package: clean build
ifndef version
	$(info Version unspecified. Using default "latest")
endif
ifndef name
	$(error lambda function name must be supplied)
endif
	mkdir -p build
	zip -r build/$(name)-$(version) $(name)/ common/

build:
ifndef name
	$(error lambda function name must be supplied)
endif
	npm --prefix ./$(name) install ./$(name)
	npm --prefix ./common install ./common

clean:
	rm -rf ./build/
