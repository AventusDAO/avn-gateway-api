## ----------------------------------------------------------------------
## Makefile used by our github actions to build and package the lambda
## functions. The following targets can be executed.
## ----------------------------------------------------------------------

help: ## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

package: ## - package the lambdas into a series of zips $ make package version=<version_no>
	npm i -g serverless
	npm --prefix ./common i ./common
	npm --prefix ./queue install ./queue
	serverless package -p build
	mkdir -p build/query-handler
	mkdir -p build/send-handler
	mkdir -p build/poll-handler
	mkdir -p build/authorisation-handler
	mkdir -p build/tx-status-update-handler
	mkdir -p build/lift-processing-handler
	mkdir -p build/vote-handler
	mkdir -p build/lower-handler
	mkdir -p build/split-fee-handler
	mkdir -p build/tx-dispatch-handler
	mkdir -p build/common
	mkdir -p build/queue
	mkdir -p build/invalid-transaction-handler

clean: ## destroys the build folder
	rm -rf ./build/
