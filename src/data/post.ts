import { AssetLoading } from "./requests";
import { Comment, CommentData, createComment } from "./comment";
import { parse, Node, NodeType, TextNode, HTMLElement } from 'node-html-parser';
import bufferToDataUrl from "buffer-to-data-url"
import fetch from "node-fetch";

type PostData = {
	_id: string;
	poster: Poster;
	content: string;
	repost?: PostData;
	time: number;
	revisions: {
		content: string;
		time: number;
		current: boolean;
	}[];
	comments: number;
	loves: number;
	reposts: number;
};

type Poster = {
	name: string;
	id: string;
};

class Post {
	content:Promise<string>;
	htmlReplacements:Record<string,string> = {};
	_id: string;
	poster: Poster;
	repost?: Promise<Post>;
	time: number;
	revisions: {
		content: string;
		time: number;
		current: boolean;
	}[];
	commentCount: number;
	comments: Promise<Comment>[] = [];
	loves: number;
	reposts: number;

	async reconstructNode(node:Node) {
		if (node instanceof HTMLElement) {
			if (node.tagName?.toLowerCase() == 'img') {
				if (node.attrs['src']) {
					const data = await (await fetch(node.attrs.src)).buffer();
					this.htmlReplacements[node.attrs.src] = await bufferToDataUrl('application/octet-stream',data);
				}
			}
		}
		for (const subNode of node.childNodes) {
			await this.reconstructNode(subNode);
		}
	}
	
	async convertHTML(html:string) {
		await this.reconstructNode(parse(html));
		for (const url in this.htmlReplacements) {
			html = html.split(url).join(this.htmlReplacements[url]);
		}
		return html.toString();
	}

	constructor(data:PostData) {
		this.content = this.convertHTML(data.content);
		this._id = data._id;
		this.poster = data.poster;
		if (data.repost) {
			this.repost = createPost(data.repost);
		}
		this.time = data.time;
		this.revisions = data.revisions;
		this.commentCount = data.comments;
		this.loves = data.loves;
		this.reposts = data.reposts;
	}

	async init() {
		const comments = JSON.parse(
			await AssetLoading.loadWebResource(
				'https://api.wasteof.money/posts/' +
					this._id +
					'/comments?page=1'
			)
		) as {
			comments: CommentData[];
		};
		
		for (const comment of comments.comments) {
			this.comments.push(createComment(comment));
		}
	}
}

async function createPost(data:PostData): Promise<Post> {
	const post = new Post(data);
	await post.init();
	return post;
}

export { Post, PostData, Poster, createPost }
