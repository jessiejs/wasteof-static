import { AssetLoading } from "./requests";
import { Post, PostData, createPost } from './post';

class Feed {
	posts: Promise<Post>[] = [];

	constructor() {
	}

	async init(username:string) {
		console.log(await AssetLoading.loadWebResource(
			'https://api.wasteof.money/users/' +
				username +
				'/following/posts',
			true
		));
		const posts = (
			JSON.parse(
				await AssetLoading.loadWebResource(
					'https://api.wasteof.money/users/' +
						username +
						'/following/posts',
					true
				)
			) as {
				posts: PostData[];
			}
		);

		for (const postData of posts.posts) {
			this.posts.push(createPost(postData));
		}
	}
}

export { Feed }
