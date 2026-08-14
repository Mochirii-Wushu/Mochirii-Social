<template>
	<b-modal
			ref="avatarUpdateModal"
			centered
			hide-footer
			header-class="py-2"
			body-class="p-0"
			title-class="w-100 text-center pl-4 font-weight-bold"
			title-tag="p"
			title="Upload Avatar"
		>
		<input type="file" class="d-none" ref="avatarUpdateRef" @change="handleAvatarUpdate($event)" :accept="avatarAccept">
		<div class="d-flex align-items-center justify-content-center">
			<div
				v-if="avatarUpdateIndex === 0"
				class="py-5 user-select-none cursor-pointer"
				v-on:drop="handleDrop"
				v-on:dragover="handleDrop"
				@click="avatarUpdateStep(0)">
				<p class="text-center primary">
					<i class="fal fa-cloud-upload fa-3x"></i>
				</p>
				<p class="text-center lead">Drag photo here or click here</p>
				<p class="text-center small text-muted mb-0">{{ avatarHelpText }}</p>
			</div>

			<div v-else-if="avatarUpdateIndex === 1" class="w-100 p-5">

				<div class="d-md-flex justify-content-between align-items-center">
					<div class="text-center mb-4">
						<p class="small font-weight-bold" style="opacity:0.7;">Current</p>
						<img :src="user.avatar" class="shadow" style="width: 150px;height: 150px;object-fit: cover;border-radius: 18px;opacity: 0.7;">
					</div>

					<div class="text-center mb-4">
						<p class="font-weight-bold">New</p>
						<img :src="avatarUpdatePreview" class="shadow" style="width: 220px;height: 220px;object-fit: cover;border-radius: 18px;">
					</div>
				</div>

				<hr>

				<div class="d-flex justify-content-between">
					<button class="btn btn-light font-weight-bold btn-block mr-3" @click="avatarUpdateClear()">Clear</button>
					<button class="btn btn-primary primary font-weight-bold btn-block mt-0" @click="confirmUpload()">Upload</button>
				</div>
			</div>
		</div>
		</b-modal>
</template>

<script type="text/javascript">
	export default {
		props: ['user'],

		data() {
			return {
				loaded: false,
				config: window.App && window.App.config && window.App.config.account && window.App.config.account.avatar ? window.App.config.account.avatar : {},
				avatarUpdateIndex: 0,
				avatarUpdateFile: undefined,
				avatarUpdatePreview: undefined
			}
		},

		computed: {
			avatarAccept() {
				return this.config.media_types || 'image/jpeg,image/jpg,image/png,image/webp';
			},

			avatarMaxBytes() {
				return (this.config.max_size || 102400) * 1024;
			},

			avatarMaxMegabytes() {
				return Math.round(this.avatarMaxBytes / 1024 / 1024);
			},

			avatarHelpText() {
				const primary = this.config.primary_size || 640;
				const thumb = this.config.thumbnail_size || 320;
				return `Upload JPEG, PNG, or WebP up to ${this.avatarMaxMegabytes} MB. Mochirii keeps it optimized automatically as ${primary}px and ${thumb}px profile images.`;
			}
		},

		methods: {
			open() {
				this.$refs.avatarUpdateModal.show();
			},

			avatarUpdateClose() {
				this.$refs.avatarUpdateModal.hide();
				this.avatarUpdateIndex = 0;
				this.avatarUpdateFile = undefined;
			},

			avatarUpdateClear() {
				this.avatarUpdateIndex = 0;
				this.avatarUpdateFile = undefined;
			},

			avatarUpdateStep(index) {
				this.$refs.avatarUpdateRef.click();
				this.avatarUpdateIndex = index;
			},

			handleAvatarUpdate(event) {
				let self = this;
				let files = event.target.files;
				Array.prototype.forEach.call(files, function(io, i) {
					self.selectAvatarFile(io);
				});
			},

			validateFile(file) {
				if(!file) {
					return false;
				}

				const allowed = this.avatarAccept.split(',').map(type => type.trim());
				if(allowed.indexOf(file.type) === -1) {
					swal('Unsupported image', 'Please upload a JPEG, PNG, or WebP profile image.', 'error');
					return false;
				}

				if(file.size > this.avatarMaxBytes) {
					swal('Image too large', `Profile images can be up to ${this.avatarMaxMegabytes} MB. Mochirii will optimize accepted images automatically.`, 'error');
					return false;
				}

				return true;
			},

			selectAvatarFile(file) {
				if(!this.validateFile(file)) {
					this.avatarUpdateClear();
					return;
				}

				this.avatarUpdateFile = file;
				this.avatarUpdatePreview = URL.createObjectURL(file);
				this.avatarUpdateIndex = 1;
			},

			handleDrop(ev) {
				ev.preventDefault();
				let self = this;

				if (ev.dataTransfer.items) {
					for (var i = 0; i < ev.dataTransfer.items.length; i++) {
						if (ev.dataTransfer.items[i].kind === 'file') {
							var file = ev.dataTransfer.items[i].getAsFile();
							if(!file) {
								return;
							}
							self.selectAvatarFile(file);
						}
					}
				} else {
					for (var i = 0; i < ev.dataTransfer.files.length; i++) {
						if(!ev.dataTransfer.files[i].hasOwnProperty('name')) {
							return;
						}
						self.selectAvatarFile(ev.dataTransfer.files[i]);
					}
				}
			},

			confirmUpload() {
				if(!this.validateFile(this.avatarUpdateFile)) {
					return;
				}

				if(!window.confirm('Are you sure you want to change your avatar photo?')) {
					return;
				}

				let formData = new FormData();
				formData.append('_method', 'PATCH');
				formData.append('avatar', this.avatarUpdateFile);

				axios.post('/api/v1/accounts/update_credentials', formData)
				.then(res => {
					window._sharedData.user.avatar = res.data.avatar;
					this.avatarUpdateClose();
				})
				.catch(err => {
					if(err.response && err.response.data && err.response.data.errors) {
						if(err.response.data.errors.avatar && err.response.data.errors.avatar.length) {
							swal('Oops!', err.response.data.errors.avatar[0], 'error');
						}
					}
				})
			}
		}
	}
</script>
