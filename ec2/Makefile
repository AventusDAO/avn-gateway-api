package:
ifndef version
	$(info no version supplied, latest assumed)
	$(eval version=latest)
endif
ifndef docker-repo
	$(eval docker-repo=avn-connector)
endif
	docker build -t $(docker-repo):$(version) .

push: package
ifndef docker-repo
	$(error docker-repo not defined, if doing local testing run $ docker package)
endif
	docker push $(docker-repo):$(version)