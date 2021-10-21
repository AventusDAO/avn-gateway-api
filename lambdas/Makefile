version=latest

## ----------------------------------------------------------------------
## Makefile used by our github actions to build and package the lambda
## functions. The following targets can be executed.
## ----------------------------------------------------------------------

help: ## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

package: clean build ## - package the lambda into a zip file $ make package version=<version_no> name=<lambda_name>
ifndef version
	$(info Version unspecified. Using default "latest")
endif
ifndef name
	$(error lambda function name must be supplied)
endif
	mkdir -p build
	zip -r build/$(name)-$(version) $(name)/ common/

build: ## compiles a lambda function along with the common folder $ make build name=<lambda_name>
ifndef name
	$(error lambda function name must be supplied)
endif
	npm --prefix ./$(name) install ./$(name)
	npm --prefix ./common install ./common

clean: ## destroys the build folder
	rm -rf ./build/
