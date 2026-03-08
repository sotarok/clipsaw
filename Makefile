VERSION := $(shell node -p "require('./package.json').version")
IMAGE := clipsaw:$(VERSION)

.PHONY: dev prod stop clean release

# 開発 (ホットリロード)
dev:
	docker compose up --build

# 本番ビルド & 起動
prod:
	docker build --target production -t $(IMAGE) .
	docker run --rm -p 3501:3000 \
		-v ./input:/media/input:ro \
		-v ./output:/media/output \
		-v ./data:/media/data \
		--name clipsaw \
		$(IMAGE)

# 停止
stop:
	-docker stop clipsaw
	-docker compose down

# イメージ削除
clean: stop
	-docker rmi $(IMAGE)

# git tag + push + GitHub Release
release:
	git tag -a v$(VERSION) -m "Release v$(VERSION)"
	git push origin main --tags
	gh release create v$(VERSION) --generate-notes --title "v$(VERSION)"
