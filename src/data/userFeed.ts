import { AssetLoading } from "./requests";
import { Post, PostData, createPost } from './post';

class UserFeed {
	posts: Promise<Post>[] = [];
	pinned: Promise<Post>[] = [];

	constructor() {
	}

	async init(username:string) {
		const posts = (
			JSON.parse(
				await AssetLoading.loadWebResource(
					'https://api.wasteof.money/users/' +
						username +
						'/posts?page=0',
					true
				)
			) as {
				pinned: PostData[];
				posts: PostData[];
			}
		);

		for (const postData of posts.pinned) {
			this.pinned.push(createPost(postData));
		}
		for (const postData of posts.posts) {
			this.posts.push(createPost(postData));
		}
	}
}

export { UserFeed }
