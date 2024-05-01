## ----------------------------------------------------------------------
## Makefile used by our github actions to build and package the lambda
## functions. The following targets can be executed.
## ----------------------------------------------------------------------

help: ## Show this help.
	@sed -ne '/@sed/!s/## //p' $(MAKEFILE_LIST)

package: ## - package the lambdas into a series of zips $ make package version=<version_no>
	npm i -g --force typescript
	npm --prefix ./common i ./common
	npx tsc
	cp ./common/package.json ./dist/common/
	cp ./common/package-lock.json ./dist/common/
	mkdir -p build/common
	cd common && zip -r ../build/common/common-latest.zip ./*
	mkdir -p build/query-handler
	zip build/query-handler/query-handler-latest.zip dist/query-handler.js
	mkdir -p build/send-handler
	zip build/send-handler/send-handler-latest.zip dist/send-handler.js
	mkdir -p build/poll-handler
	zip build/poll-handler/poll-handler-latest.zip dist/poll-handler.js
	mkdir -p build/authorisation-handler
	zip build/authorisation-handler/authorisation-handler-latest.zip dist/authorisation-handler.js
	mkdir -p build/autolower-handler
	zip build/autolower-handler/autolower-handler-latest.zip dist/autolower-handler.js
	mkdir -p build/tx-status-update-handler
	zip build/tx-status-update-handler/tx-status-update-handler-latest.zip dist/tx-status-update-handler.js
	mkdir -p build/lift-processing-handler
	zip build/lift-processing-handler/lift-processing-handler-latest.zip dist/lift-processing-handler.js
	mkdir -p build/vote-handler
	zip build/vote-handler/vote-handler-latest.zip dist/vote-handler.js
	mkdir -p build/lower-handler
	zip build/lower-handler/lower-handler-latest.zip dist/lower-handler.js
	mkdir -p build/split-fee-handler
	zip build/split-fee-handler/split-fee-handler-latest.zip dist/split-fee-handler.js
	mkdir -p build/tx-dispatch-handler
	zip build/tx-dispatch-handler/tx-dispatch-handler-latest.zip dist/tx-dispatch-handler.js
	mkdir -p build/invalid-transaction-handler
	zip build/invalid-transaction-handler/invalid-transaction-handler-latest.zip dist/invalid-transaction-handler.js
	mkdir -p build/webhooks-event-emitter-handler
	zip build/webhooks-event-emitter-handler/webhooks-event-emitter-handler-latest.zip dist/webhooks-event-emitter-handler.js
	mkdir -p build/webhooks-verification-key-handler
	zip build/webhooks-verification-key-handler/webhooks-verification-key-handler-latest.zip dist/webhooks-verification-key-handler.js
	cp build/common/common-latest.zip build/common/common-$(version).zip
	cp build/query-handler/query-handler-latest.zip build/query-handler/query-handler-$(version).zip
	cp build/send-handler/send-handler-latest.zip build/send-handler/send-handler-$(version).zip
	cp build/poll-handler/poll-handler-latest.zip build/poll-handler/poll-handler-$(version).zip
	cp build/authorisation-handler/authorisation-handler-latest.zip build/authorisation-handler/authorisation-handler-$(version).zip
	cp build/autolower-handler/autolower-handler-latest.zip build/autolower-handler/autolower-handler-$(version).zip
	cp build/tx-status-update-handler/tx-status-update-handler-latest.zip build/tx-status-update-handler/tx-status-update-handler-$(version).zip
	cp build/lift-processing-handler/lift-processing-handler-latest.zip build/lift-processing-handler/lift-processing-handler-$(version).zip
	cp build/vote-handler/vote-handler-latest.zip build/vote-handler/vote-handler-$(version).zip
	cp build/lower-handler/lower-handler-latest.zip build/lower-handler/lower-handler-$(version).zip
	cp build/split-fee-handler/split-fee-handler-latest.zip build/split-fee-handler/split-fee-handler-$(version).zip
	cp build/tx-dispatch-handler/tx-dispatch-handler-latest.zip build/tx-dispatch-handler/tx-dispatch-handler-$(version).zip
	cp build/invalid-transaction-handler/invalid-transaction-handler-latest.zip build/invalid-transaction-handler/invalid-transaction-handler-$(version).zip
	cp build/webhooks-event-emitter-handler/webhooks-event-emitter-handler-latest.zip build/webhooks-event-emitter-handler/webhooks-event-emitter-handler-$(version).zip
	cp build/webhooks-verification-key-handler/webhooks-verification-key-handler-latest.zip build/webhooks-verification-key-handler/webhooks-verification-key-handler-$(version).zip

clean: ## destroys the build folder
	rm -rf ./build/
