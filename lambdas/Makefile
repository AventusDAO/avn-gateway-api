## ----------------------------------------------------------------------
## Makefile used by our github actions to build and package the lambda
## functions. The following targets can be executed.
## ----------------------------------------------------------------------

help: ## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

package: build ## - package the lambda into a zip file $ make package version=<version_no> name=<lambda_name>
ifndef version
	$(info Version unspecified. Using default "latest")
	$(eval version=latest)
endif
ifndef name
	$(error lambda function name must be supplied)
endif
ifndef zip
	$(eval zip=true)
endif
	mkdir -p build/$(name)
	node update.js lambda $(name) $(zip)
	mv build/$(name).zip build/$(name)/$(name)-$(version).zip

package-layer: ## - package the lambda layer into a zip file $ make package-layer version=<version_no>
ifndef version
	$(info Version unspecified. Using default "latest")
	$(eval version=latest)
endif
ifndef zip
	$(eval zip=true)
endif
	$(eval name=common-layer)
	mkdir -p build/$(name)
	npm --prefix ./layer/nodejs install ./layer/nodejs
	node update.js layer $(name) $(zip)
	mv build/$(name).zip build/$(name)/$(name)-$(version).zip

build: ## compiles a lambda function along with the common folder $ make build name=<lambda_name>
ifndef name
	$(error lambda function name must be supplied)
endif
	npm --prefix ./$(name) install ./$(name)
	npm install

clean: ## destroys the build folder
	rm -rf ./build/
