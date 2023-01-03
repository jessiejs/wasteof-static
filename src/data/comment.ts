import { AssetLoading } from "./requests";
import { Poster } from './post';

class Comment {
	_id: string;
	post: string;
	poster: Poster;
	parent: any;
	content: string;
	time: number;
	hasReplies: boolean;
	replies: Promise<Comment>[] = [];

	constructor(data:CommentData) {
		this._id = data._id;
		this.post = data.post;
		this.poster = data.poster;
		this.content = data.content;
		this.time = data.time;
		this.hasReplies = data.hasReplies;
	}

	async init() {
		if (this.hasReplies) {
			const replies = JSON.parse(
				await AssetLoading.loadWebResource(
					'https://api.wasteof.money/comments/' +
						this._id +
						'/replies?page=1'
				)
			) as {
				comments: Comment[];
			};
			for (const reply of replies.comments) {
				this.replies.push(createComment(reply));
			}
		}
	}
}

type CommentData = {
	_id: string;
	post: string;
	poster: Poster;
	parent: any;
	content: string;
	time: number;
	hasReplies: boolean;
};

async function createComment(data:CommentData): Promise<Comment> {
	const comment = new Comment(data);
	await comment.init();
	return comment;
}

export { Comment, CommentData, createComment }
