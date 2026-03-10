VERSION := $(shell node -p "require('./package.json').version")
IMAGE := clipsaw:$(VERSION)

.PHONY: dev prod stop clean release tauri-dev tauri-build

# 開発 (ホットリロード)
dev:
	docker compose up --build

# 本番ビルド & 起動
prod:
	docker build --target production -t $(IMAGE) .
	docker run --rm -p 3501:3501 \
		-e PORT=3501 \
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

# Tauri 開発 (ネイティブアプリ)
tauri-dev:
	cargo tauri dev

# Tauri プロダクションビルド
tauri-build:
	cargo tauri build

# git tag + push + GitHub Release
release:
	git tag -a v$(VERSION) -m "Release v$(VERSION)"
	git push origin main --tags
	gh release create v$(VERSION) --generate-notes --title "v$(VERSION)"
