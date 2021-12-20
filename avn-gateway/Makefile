## ----------------------------------------------------------------------
## Makefile used by our github actions to build and package the lambda
## functions. The following targets can be executed.
## ----------------------------------------------------------------------

help: ## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

package: ## - package the lambdas with serverless to the build directory
	npm i serverless
	serverless package -p build

clean: ## destroys the build folder
	rm -rf ./build/