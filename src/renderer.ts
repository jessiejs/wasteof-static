import { Stream, Writable } from 'stream';
import fetch from 'node-fetch';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Post } from './data/post';
import { Comment } from './data/comment';
import { Feed } from './data/feed';
import { UserFeed } from './data/userFeed';
import bufferToDataUrl from "buffer-to-data-url"
import { AssetLoading } from './data/requests';

class Renderer {
	output: Writable;

	scriptBundles: Promise<string>[] = [];
	styleBundles: Promise<string>[] = [];

	importedStyles: string[] = [];
	importedScripts: string[] = [];

	htmlReplacements: Record<string,string> = {};

	includeBundlesImmediately: boolean = true;

	constructor(output: Writable) {
		this.output = output;
	}

	async write(text: string) {
		/*const chars = Array.from(text);
		for (let i = 0; i < chars.length; i++) {
			this.output.write(chars[i]);
			//await this.wait(0);
		}*/
		this.output.write(text);
		//await this.wait(10);
	}

	wait(ms: number): Promise<void> {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	style(object: Record<string, string>) {
		let output = '';
		for (const styleName in object) {
			output += this.camelCaseToDashCase(styleName);
			output += ':';
			output += object[styleName];
			output += ';';
		}
		return output;
	}

	camelCaseToDashCase(text: string) {
		let output = '';
		for (let i = 0; i < text.length; i++) {
			if (text[i].toLowerCase() != text[i]) {
				output += '-';
			}
			output += text[i].toLowerCase();
		}
		return output;
	}

	async htmlTemplate(callback: () => Promise<void>) {
		await this.write('<!DOCTYPE html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>wasteof.static</title><body>');
		await this.includeStyleBundle('page');
		if (this.includeBundlesImmediately) {
			await this.element("style",{},async () => {
				await this.renderFontImport();
			});
		}
		await callback();
		await this.write('</body><head>');
		await this.renderBundles();
		await this.write('</head></html>');
	}

	async renderUserFeed(username: string) {
		await this.element('h1', {}, async () => {
			await this.write('@' + username);
		});

		const feed = new UserFeed();
		await feed.init(username);
		const posts = feed.posts;
		const pinned = feed.pinned;

		if (pinned.length > 0) {
			await this.element('h2', {}, async () => {
				await this.write('Pinned');
			});
			for (const post of pinned) {
				await this.renderPostContainer(await post);
			}
			await this.element('h2', {}, async () => {
				await this.write('Not Pinned');
			});
		}

		for (const post of posts) {
			await this.renderPostContainer(await post);
		}
	}

	async renderFeedOfUser(username: string) {
		await this.element('h1', {}, async () => {
			await this.write('feed');
		});

		const feed = new Feed();
		await feed.init(username);
		const posts = feed.posts;

		for (const post of posts) {
			await this.renderPostContainer(await post);
		}
	}

	async renderPost(post: Post) {
		await this.includeStyleBundle('post');
		await this.element(
			'div',
			{
				class: 'post',
			},
			async () => {
				await this.element('h3', {}, async () => {
					await this.write(post.poster.name);
				});
				await this.write(await post.content);
				if (post.repost) {
					await this.renderPost(await post.repost);
				}
				if (post.revisions.length > 1) {
					await this.element('p', {}, async () => {
						await this.element('i', {}, async () => {
							await this.write('(edited)');
						});
					});
				}
				await this.element('p', {}, async () => {
					await this.element('button', {}, async () => {
						await this.write(`💕 ${post.loves}`);
					});
					await this.element('button', {}, async () => {
						await this.write(`🔃 ${post.reposts}`);
					});
					await this.element('button', {}, async () => {
						await this.write(`💬 ${post.commentCount}`);
					});
				});
			}
		);
	}

	async renderPostContainer(post: Post) {
		await this.element('div', {
			class:'splitView'
		}, async () => {
			await this.renderPost(post);
			if (post.commentCount > 0) {
				await this.element('div', {
					class:'post'
				}, async () => {
					await this.renderPostComments(post);
				});
			}
		});
	}

	async renderPostComments(post: Post) {
		const comments = post.comments;

		if (comments.length > 0) {
			await this.element('h3', {}, async () => {
				await this.write('Comments');
			});
		}

		for (let i = 0; i < comments.length; i++) {
			await this.renderComment(await comments[i]);
		}
	}

	async renderCommentReplies(comment: Comment) {
		await this.includeStyleBundle('reply');
		await this.element('div',{
			class:'replies'
		},async () => {
			const replies = comment.replies;

			for (const comment of replies) {
				await this.renderComment(await comment);
			}
		});
	}

	async renderComment(comment: Comment) {
		await this.element(
			'div',
			{
				class: 'post',
			},
			async () => {
				await this.element('h3', {}, async () => {
					await this.write(comment.poster.name);
				});
				await this.write(comment.content);
			}
		);
		await this.renderCommentReplies(comment);
	}

	async element(
		name: string,
		properties: Record<string, string>,
		callback: () => Promise<void>
	) {
		// write opening
		await this.write('<');
		await this.write(name);

		// write props
		for (const propName in properties) {
			await this.write(' ');
			await this.write(propName);
			await this.write('="');
			await this.write(properties[propName]);
			await this.write('"');
		}

		// write end of beginning
		await this.write('>');

		// write content
		await callback();

		// write end
		await this.write('</');
		await this.write(name);
		await this.write('>');
	}

	async includeScriptBundle(name: string) {
		if (!this.importedScripts.includes(name)) {
			this.importedScripts.push(name);
			if (this.includeBundlesImmediately) {
				await this.element('script',{}, async () => {
					this.write(await AssetLoading.loadFile(
						join(__dirname, '../', 'scripts', name + '.js')
					));
				});
			} else {
				this.scriptBundles.push(
					AssetLoading.loadFile(
						join(__dirname, '../', 'scripts', name + '.js')
					)
				);
			}
		}
	}

	async includeStyleBundle(name: string) {
		if (!this.importedStyles.includes(name)) {
			this.importedStyles.push(name);
			if (this.includeBundlesImmediately) {
				await this.element('style',{}, async () => {
					this.write(await AssetLoading.loadFile(
						join(__dirname, '../', 'styles', name + '.css')
					));
				});
			} else {
				this.styleBundles.push(
					AssetLoading.loadFile(
						join(__dirname, '../', 'styles', name + '.css')
					)
				);
			}
		}
	}

	async renderBundles() {
		if (this.includeBundlesImmediately) {
			return;
		}
		await this.element('script', {}, async () => {
			await this.write((await Promise.all(this.scriptBundles)).join(' '));
		});
		await this.element('style', {}, async () => {
			await this.write((await Promise.all(this.styleBundles)).join(' '));
			await this.renderFontImport();
		});
	}

	async renderFontImport() {
		// write start
		await this.write(
			'@font-face { font-family: "Satoshi"; font-weight: 500; font-display: swap; font-style: normal; src: url("'
		);
		// write data url
		/*await this.write(
			await AssetLoading.loadFile(
				join(__dirname, '../', 'SatoshiDataUri.txt')
			)
		);*/
		await this.write(await bufferToDataUrl('application/octet-stream',await readFile(join(__dirname,'../','styles','Satoshi.ttf'))));
		// TODO: DO NOT LOAD EXTERNAL RESOURCE!!!!!!!!!!!
		/*await this.write(
			'//cdn.fontshare.com/wf/P2LQKHE6KA6ZP4AAGN72KDWMHH6ZH3TA/ZC32TK2P7FPS5GFTL46EU6KQJA24ZYDB/7AHDUZ4A7LFLVFUIFSARGIWCRQJHISQP.ttf'
		);*/
		await this.write('") format("truetype") }');
	}
}

export { Renderer };
