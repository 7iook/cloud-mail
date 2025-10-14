import settingService from '../service/setting-service';
import emailUtils from '../utils/email-utils';
import {emailConst} from "../const/entity-const";
import { t } from '../i18n/i18n'

const init = {
	async init(c) {

		const secret = c.req.param('secret');

		if (secret !== c.env.jwt_secret) {
			return c.text(t('JWTMismatch'));
		}

		await this.intDB(c);
		await this.v1_1DB(c);
		await this.v1_2DB(c);
		await this.v1_3DB(c);
		await this.v1_3_1DB(c);
		await this.v1_4DB(c);
		await this.v1_5DB(c);
		await this.v1_6DB(c);
		await this.v1_7DB(c);
		await this.v2DB(c);
		await this.v2_1DB(c); // MVP: 分享管理功能增强
		await this.v2_2DB(c); // 添加显示数量限制和访问次数限制的开关控制
		await this.v2_3DB(c); // 添加分享域名字段支持
		await settingService.refresh(c);
		return c.text(t('initSuccess'));
	},

	async v2_1DB(c) {
		// MVP: 分享管理功能增强 - 添加状态管理、每日统计等字段
		const ADD_COLUMN_SQL_LIST = [
			`ALTER TABLE share ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'disabled'));`,
			`ALTER TABLE share ADD COLUMN otp_count_daily INTEGER DEFAULT 0;`,
			`ALTER TABLE share ADD COLUMN otp_limit_daily INTEGER DEFAULT 100;`,
			`ALTER TABLE share ADD COLUMN last_reset_date TEXT;`,
			`ALTER TABLE share ADD COLUMN remark TEXT DEFAULT '';`,
			`ALTER TABLE share ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;`,
			`CREATE INDEX IF NOT EXISTS idx_share_status ON share(status);`,
			`CREATE INDEX IF NOT EXISTS idx_share_expire_time ON share(expire_time);`,
			`CREATE INDEX IF NOT EXISTS idx_share_user_status ON share(user_id, status);`,
			`CREATE INDEX IF NOT EXISTS idx_share_user_expire ON share(user_id, expire_time);`
		];

		const promises = ADD_COLUMN_SQL_LIST.map(async (sql) => {
			try {
				await c.env.db.prepare(sql).run();
			} catch (e) {
				console.warn(`跳过字段添加或索引创建，原因：${e.message}`);
			}
		});

		await Promise.all(promises);

		// 初始化现有数据的状态
		try {
			await c.env.db.prepare(`
				UPDATE share
				SET status = CASE
					WHEN is_active = 0 THEN 'disabled'
					WHEN datetime(expire_time) < datetime('now') THEN 'expired'
					ELSE 'active'
				END
				WHERE status IS NULL OR status = 'active'
			`).run();

			// 初始化 last_reset_date 为今天
			await c.env.db.prepare(`
				UPDATE share
				SET last_reset_date = date('now')
				WHERE last_reset_date IS NULL
			`).run();
		} catch (e) {
			console.warn(`跳过数据初始化，原因：${e.message}`);
		}
	},

	async v2DB(c) {
		try {
			await c.env.db.batch([
				c.env.db.prepare(`ALTER TABLE setting ADD COLUMN bucket TEXT NOT NULL DEFAULT '';`),
				c.env.db.prepare(`ALTER TABLE setting ADD COLUMN region TEXT NOT NULL DEFAULT '';`),
				c.env.db.prepare(`ALTER TABLE setting ADD COLUMN endpoint TEXT NOT NULL DEFAULT '';`),
				c.env.db.prepare(`ALTER TABLE setting ADD COLUMN s3_access_key TEXT NOT NULL DEFAULT '';`),
				c.env.db.prepare(`ALTER TABLE setting ADD COLUMN s3_secret_key TEXT NOT NULL DEFAULT '';`),
				c.env.db.prepare(`DELETE FROM perm WHERE perm_key = 'setting:clean'`)
			]);
		} catch (e) {
			console.error(e.message)
		}
	},

	async v2_2DB(c) {
		// 添加显示数量限制和访问次数限制的开关控制
		try {
			await c.env.db.batch([
				c.env.db.prepare(`ALTER TABLE share ADD COLUMN verification_code_limit INTEGER DEFAULT 100 NOT NULL;`),
				c.env.db.prepare(`ALTER TABLE share ADD COLUMN verification_code_limit_enabled INTEGER DEFAULT 1 NOT NULL;`),
				c.env.db.prepare(`ALTER TABLE share ADD COLUMN otp_limit_enabled INTEGER DEFAULT 1 NOT NULL;`)
			]);

			// 更新现有记录
			await c.env.db.prepare(`
				UPDATE share SET
					verification_code_limit = 100,
					verification_code_limit_enabled = 1,
					otp_limit_enabled = 1
				WHERE verification_code_limit IS NULL
			`).run();
		} catch (e) {
			console.warn(`跳过字段添加，原因：${e.message}`);
		}
	},

	async v2_3DB(c) {
		// 添加分享域名字段支持
		try {
			await c.env.db.prepare(`ALTER TABLE share ADD COLUMN share_domain TEXT;`).run();

			// 创建索引优化查询性能
			await c.env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_share_domain ON share(share_domain);`).run();

			console.log('分享域名字段添加成功');
		} catch (e) {
			console.warn(`跳过分享域名字段添加，原因：${e.message}`);
		}
	},

	async v1_7DB(c) {
		try {
			await c.env.db.prepare(`ALTER TABLE setting ADD COLUMN login_domain INTEGER NOT NULL DEFAULT 0;`).run();
		} catch (e) {
			console.warn(`通过字段，原因：${e.message}`);
		}
	},

	async v1_6DB(c) {

		const noticeContent = '本项目仅供学习交流，禁止用于违法业务\n' +
			'<br>\n' +
			'请遵守当地法规，作者不承担任何法律责任\n' +
			'<div style="display: flex;gap: 18px;margin-top: 10px;">\n' +
			'<a href="https://github.com/eoao/cloud-mail" target="_blank" >\n' +
			'<img src="https://api.iconify.design/codicon:github-inverted.svg" alt="GitHub" width="25" height="25" />\n' +
			'</a>\n' +
			'<a href="https://t.me/cloud_mail_tg" target="_blank" >\n' +
			'<img src="https://api.iconify.design/logos:telegram.svg" alt="GitHub" width="25" height="25" />\n' +
			'</a>\n' +
			'</div>\n'

		const ADD_COLUMN_SQL_LIST = [
			`ALTER TABLE setting ADD COLUMN reg_verify_count INTEGER NOT NULL DEFAULT 1;`,
			`ALTER TABLE setting ADD COLUMN add_verify_count INTEGER NOT NULL DEFAULT 1;`,
			`CREATE TABLE IF NOT EXISTS verify_record (
				vr_id INTEGER PRIMARY KEY AUTOINCREMENT,
				ip TEXT NOT NULL DEFAULT '',
				count INTEGER NOT NULL DEFAULT 1,
				type INTEGER NOT NULL DEFAULT 0,
				update_time DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
			`ALTER TABLE setting ADD COLUMN notice_title TEXT NOT NULL DEFAULT 'Cloud Mail';`,
			`ALTER TABLE setting ADD COLUMN notice_content TEXT NOT NULL DEFAULT '';`,
			`ALTER TABLE setting ADD COLUMN notice_type TEXT NOT NULL DEFAULT 'none';`,
			`ALTER TABLE setting ADD COLUMN notice_duration INTEGER NOT NULL DEFAULT 0;`,
			`ALTER TABLE setting ADD COLUMN notice_offset INTEGER NOT NULL DEFAULT 0;`,
			`ALTER TABLE setting ADD COLUMN notice_position TEXT NOT NULL DEFAULT 'top-right';`,
			`ALTER TABLE setting ADD COLUMN notice_width INTEGER NOT NULL DEFAULT 340;`,
			`ALTER TABLE setting ADD COLUMN notice INTEGER NOT NULL DEFAULT 0;`,
			`ALTER TABLE setting ADD COLUMN no_recipient INTEGER NOT NULL DEFAULT 1;`,
			`UPDATE role SET avail_domain = '' WHERE role.avail_domain LIKE '@%';`,
			`UPDATE role SET ban_email = '';`,
			`CREATE INDEX IF NOT EXISTS idx_email_user_id_account_id ON email(user_id, account_id);`
		];

		const promises = ADD_COLUMN_SQL_LIST.map(async (sql) => {
			try {
				await c.env.db.prepare(sql).run();
			} catch (e) {
				console.warn(`通过字段，原因：${e.message}`);
			}
		});

		await Promise.all(promises);
		await c.env.db.prepare(`UPDATE setting SET notice_content = ? WHERE notice_content = '';`).bind(noticeContent).run();
		try {
			await c.env.db.batch([
				c.env.db.prepare(`DROP INDEX IF EXISTS idx_account_email`),
				c.env.db.prepare(`DROP INDEX IF EXISTS idx_user_email`),
				c.env.db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_account_email_nocase ON account (email COLLATE NOCASE)`),
				c.env.db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_nocase ON user (email COLLATE NOCASE)`)
			]);
		} catch (e) {
			console.error(e.message)
		}

	},

	async v1_5DB(c) {
		await c.env.db.prepare(`UPDATE perm SET perm_key = 'all-email:query' WHERE perm_key = 'sys-email:query'`).run();
		await c.env.db.prepare(`UPDATE perm SET perm_key = 'all-email:delete' WHERE perm_key = 'sys-email:delete'`).run();
		try {
			await c.env.db.prepare(`ALTER TABLE role ADD COLUMN avail_domain TEXT NOT NULL DEFAULT ''`).run();
		} catch (e) {
			console.warn(`跳过字段添加，原因：${e.message}`);
		}
	},

	async v1_4DB(c) {
		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS reg_key (
				rege_key_id INTEGER PRIMARY KEY AUTOINCREMENT,
				code TEXT NOT NULL COLLATE NOCASE DEFAULT '',
				count INTEGER NOT NULL DEFAULT 0,
				role_id INTEGER NOT NULL DEFAULT 0,
				user_id INTEGER NOT NULL DEFAULT 0,
				expire_time DATETIME,
				create_time DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

		// 添加不区分大小写的唯一索引
		try {
			await c.env.db.prepare(`
				CREATE UNIQUE INDEX IF NOT EXISTS idx_setting_code ON reg_key(code COLLATE NOCASE)
			`).run();
		} catch (e) {
			console.warn(`跳过创建索引，原因：${e.message}`);
		}


		try {
			await c.env.db.prepare(`
        INSERT INTO perm (perm_id, name, perm_key, pid, type, sort) VALUES
        (33,'注册密钥', NULL, 0, 1, 5.1),
        (34,'密钥查看', 'reg-key:query', 33, 2, 0),
        (35,'密钥添加', 'reg-key:add', 33, 2, 1),
        (36,'密钥删除', 'reg-key:delete', 33, 2, 2)`).run();
		} catch (e) {
			console.warn(`跳过数据，原因：${e.message}`);
		}

		const ADD_COLUMN_SQL_LIST = [
			`ALTER TABLE setting ADD COLUMN reg_key INTEGER NOT NULL DEFAULT 1;`,
			`ALTER TABLE role ADD COLUMN ban_email TEXT NOT NULL DEFAULT '';`,
			`ALTER TABLE role ADD COLUMN ban_email_type INTEGER NOT NULL DEFAULT 0;`,
			`ALTER TABLE user ADD COLUMN reg_key_id INTEGER NOT NULL DEFAULT 0;`
		];

		const promises = ADD_COLUMN_SQL_LIST.map(async (sql) => {
			try {
				await c.env.db.prepare(sql).run();
			} catch (e) {
				console.warn(`跳过字段添加，原因：${e.message}`);
			}
		});

		await Promise.all(promises);

	},

	async v1_3_1DB(c) {
		await c.env.db.prepare(`UPDATE email SET name = SUBSTR(send_email, 1, INSTR(send_email, '@') - 1) WHERE (name IS NULL OR name = '') AND type = ${emailConst.type.RECEIVE}`).run();
	},

	async v1_3DB(c) {

		const ADD_COLUMN_SQL_LIST = [
			`ALTER TABLE setting ADD COLUMN tg_bot_token TEXT NOT NULL DEFAULT '';`,
			`ALTER TABLE setting ADD COLUMN tg_chat_id TEXT NOT NULL DEFAULT '';`,
			`ALTER TABLE setting ADD COLUMN tg_bot_status INTEGER NOT NULL DEFAULT 1;`,
			`ALTER TABLE setting ADD COLUMN forward_email TEXT NOT NULL DEFAULT '';`,
			`ALTER TABLE setting ADD COLUMN forward_status INTEGER TIME NOT NULL DEFAULT 1;`,
			`ALTER TABLE setting ADD COLUMN rule_email TEXT NOT NULL DEFAULT '';`,
			`ALTER TABLE setting ADD COLUMN rule_type INTEGER NOT NULL DEFAULT 0;`
		];

		const promises = ADD_COLUMN_SQL_LIST.map(async (sql) => {
			try {
				await c.env.db.prepare(sql).run();
			} catch (e) {
				console.warn(`跳过字段添加，原因：${e.message}`);
			}
		});

		await Promise.all(promises);

		const nameColumn = await c.env.db.prepare(`SELECT * FROM pragma_table_info('email') WHERE name = 'to_email' limit 1`).first();

		if (nameColumn) {
			return
		}

		const queryList = []

		queryList.push(c.env.db.prepare(`ALTER TABLE email ADD COLUMN to_email TEXT NOT NULL DEFAULT ''`));
		queryList.push(c.env.db.prepare(`ALTER TABLE email ADD COLUMN to_name TEXT NOT NULL DEFAULT ''`));
		queryList.push(c.env.db.prepare(`UPDATE email SET to_email = json_extract(recipient, '$[0].address'), to_name = json_extract(recipient, '$[0].name')`));

		await c.env.db.batch(queryList);

	},

	async v1_2DB(c){

		const ADD_COLUMN_SQL_LIST = [
			`ALTER TABLE email ADD COLUMN recipient TEXT NOT NULL DEFAULT '[]';`,
			`ALTER TABLE email ADD COLUMN cc TEXT NOT NULL DEFAULT '[]';`,
			`ALTER TABLE email ADD COLUMN bcc TEXT NOT NULL DEFAULT '[]';`,
			`ALTER TABLE email ADD COLUMN message_id TEXT NOT NULL DEFAULT '';`,
			`ALTER TABLE email ADD COLUMN in_reply_to TEXT NOT NULL DEFAULT '';`,
			`ALTER TABLE email ADD COLUMN relation TEXT NOT NULL DEFAULT '';`
		];

		const promises = ADD_COLUMN_SQL_LIST.map(async (sql) => {
			try {
				await c.env.db.prepare(sql).run();
			} catch (e) {
				console.warn(`跳过字段添加，原因：${e.message}`);
			}
		});

		await Promise.all(promises);

		await this.receiveEmailToRecipient(c);
		await this.initAccountName(c);
		await this.addShareWhitelistColumn(c);
		await this.createShareTable(c);
		await this.createShareAccessLogTable(c);

		try {
			await c.env.db.prepare(`
        INSERT INTO perm (perm_id, name, perm_key, pid, type, sort) VALUES
        (31,'分析页', NULL, 0, 1, 2.1),
        (32,'数据查看', 'analysis:query', 31, 2, 1)`).run();
		} catch (e) {
			console.warn(`跳过数据，原因：${e.message}`);
		}

		try {
			await c.env.db.prepare(`
        INSERT INTO perm (perm_id, name, perm_key, pid, type, sort) VALUES
        (33,'邮件分享', NULL, 0, 1, 2.2),
        (34,'分享创建', 'share:create', 33, 2, 1),
        (35,'分享删除', 'share:delete', 33, 2, 2)`).run();
		} catch (e) {
			console.warn(`跳过分享权限数据，原因：${e.message}`);
		}

	},

	async v1_1DB(c) {
		// 添加字段
		const ADD_COLUMN_SQL_LIST = [
			`ALTER TABLE email ADD COLUMN type INTEGER NOT NULL DEFAULT 0;`,
			`ALTER TABLE email ADD COLUMN status INTEGER NOT NULL DEFAULT 0;`,
			`ALTER TABLE email ADD COLUMN resend_email_id TEXT;`,
			`ALTER TABLE email ADD COLUMN message TEXT;`,

			`ALTER TABLE setting ADD COLUMN resend_tokens TEXT NOT NULL DEFAULT '{}';`,
			`ALTER TABLE setting ADD COLUMN send INTEGER NOT NULL DEFAULT 0;`,
			`ALTER TABLE setting ADD COLUMN r2_domain TEXT;`,
			`ALTER TABLE setting ADD COLUMN site_key TEXT;`,
			`ALTER TABLE setting ADD COLUMN secret_key TEXT;`,
			`ALTER TABLE setting ADD COLUMN background TEXT;`,
			`ALTER TABLE setting ADD COLUMN login_opacity INTEGER NOT NULL DEFAULT 0.88;`,

			`ALTER TABLE user ADD COLUMN create_ip TEXT;`,
			`ALTER TABLE user ADD COLUMN active_ip TEXT;`,
			`ALTER TABLE user ADD COLUMN os TEXT;`,
			`ALTER TABLE user ADD COLUMN browser TEXT;`,
			`ALTER TABLE user ADD COLUMN device TEXT;`,
			`ALTER TABLE user ADD COLUMN sort INTEGER NOT NULL DEFAULT 0;`,
			`ALTER TABLE user ADD COLUMN send_count INTEGER NOT NULL DEFAULT 0;`,

			`ALTER TABLE attachments ADD COLUMN status INTEGER NOT NULL DEFAULT 0;`,
			`ALTER TABLE attachments ADD COLUMN type INTEGER NOT NULL DEFAULT 0;`
		];

		const promises = ADD_COLUMN_SQL_LIST.map(async (sql) => {
			try {
				await c.env.db.prepare(sql).run();
			} catch (e) {
				console.warn(`跳过字段添加，原因：${e.message}`);
			}
		});

		await Promise.all(promises);

		// 创建 perm 表并初始化
		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS perm (
        perm_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        perm_key TEXT,
        pid INTEGER NOT NULL DEFAULT 0,
        type INTEGER NOT NULL DEFAULT 2,
        sort INTEGER
      )
    `).run();

		const {permTotal} = await c.env.db.prepare(`SELECT COUNT(*) as permTotal FROM perm`).first();

		if (permTotal === 0) {
			await c.env.db.prepare(`
        INSERT INTO perm (perm_id, name, perm_key, pid, type, sort) VALUES
        (1, '邮件', NULL, 0, 0, 0),
        (2, '邮件删除', 'email:delete', 1, 2, 1),
        (3, '邮件发送', 'email:send', 1, 2, 0),
        (4, '个人设置', '', 0, 1, 2),
        (5, '用户注销', 'my:delete', 4, 2, 0),
        (6, '用户信息', NULL, 0, 1, 3),
        (7, '用户查看', 'user:query', 6, 2, 0),
        (8, '密码修改', 'user:set-pwd', 6, 2, 2),
        (9, '状态修改', 'user:set-status', 6, 2, 3),
        (10, '权限修改', 'user:set-type', 6, 2, 4),
        (11, '用户删除', 'user:delete', 6, 2, 7),
        (12, '用户收藏', 'user:star', 6, 2, 5),
        (13, '权限控制', '', 0, 1, 5),
        (14, '身份查看', 'role:query', 13, 2, 0),
        (15, '身份修改', 'role:set', 13, 2, 1),
        (16, '身份删除', 'role:delete', 13, 2, 2),
        (17, '系统设置', '', 0, 1, 6),
        (18, '设置查看', 'setting:query', 17, 2, 0),
        (19, '设置修改', 'setting:set', 17, 2, 1),
        (21, '邮箱侧栏', '', 0, 0, 1),
        (22, '邮箱查看', 'account:query', 21, 2, 0),
        (23, '邮箱添加', 'account:add', 21, 2, 1),
        (24, '邮箱删除', 'account:delete', 21, 2, 2),
        (25, '用户添加', 'user:add', 6, 2, 1),
        (26, '发件重置', 'user:reset-send', 6, 2, 6),
        (27, '邮件列表', '', 0, 1, 4),
        (28, '邮件查看', 'all-email:query', 27, 2, 0),
        (29, '邮件删除', 'all-email:delete', 27, 2, 0),
				(30, '身份添加', 'role:add', 13, 2, -1)
      `).run();
		}

		await c.env.db.prepare(`UPDATE perm SET perm_key = 'setting:clean' WHERE perm_key = 'seting:clear'`).run();
		await c.env.db.prepare(`DELETE FROM perm WHERE perm_key = 'user:star'`).run();
		// 创建 role 表并插入默认身份
		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS role (
        role_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        key TEXT,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        sort INTEGER DEFAULT 0,
        description TEXT,
        user_id INTEGER,
        is_default INTEGER DEFAULT 0,
        send_count INTEGER,
        send_type TEXT NOT NULL DEFAULT 'count',
        account_count INTEGER
      )
    `).run();

		const { roleCount } = await c.env.db.prepare(`SELECT COUNT(*) as roleCount FROM role`).first();
		if (roleCount === 0) {
			await c.env.db.prepare(`
        INSERT INTO role (
          role_id, name, key, create_time, sort, description, user_id, is_default, send_count, send_type, account_count
        ) VALUES (
          1, '普通用户', NULL, '0000-00-00 00:00:00', 0, '只有普通使用权限', 0, 1, NULL, 'ban', 10
        )
      `).run();
		}

		// 创建 role_perm 表并初始化数据
		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS role_perm (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER,
        perm_id INTEGER
      )
    `).run();

		const {rolePermCount} = await c.env.db.prepare(`SELECT COUNT(*) as rolePermCount FROM role_perm`).first();
		if (rolePermCount === 0) {
			await c.env.db.prepare(`
        INSERT INTO role_perm (id, role_id, perm_id) VALUES
          (100, 1, 2),
          (101, 1, 21),
          (102, 1, 22),
          (103, 1, 23),
          (104, 1, 24),
          (105, 1, 4),
          (106, 1, 5),
          (107, 1, 1),
          (108, 1, 3)
      `).run();
		}
	},

	async intDB(c) {
		// 初始化数据库表结构
		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS email (
        email_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        send_email TEXT,
        name TEXT,
        account_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        subject TEXT,
        content TEXT,
        text TEXT,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        is_del INTEGER DEFAULT 0 NOT NULL
      )
    `).run();

		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS star (
        star_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email_id INTEGER NOT NULL,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `).run();

		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS attachments (
        att_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        filename TEXT,
        mime_type TEXT,
        size INTEGER,
        disposition TEXT,
        related TEXT,
        content_id TEXT,
        encoding TEXT,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `).run();

		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS user (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        type INTEGER DEFAULT 1 NOT NULL,
        password TEXT NOT NULL,
        salt TEXT NOT NULL,
        status INTEGER DEFAULT 0 NOT NULL,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        active_time DATETIME,
        is_del INTEGER DEFAULT 0 NOT NULL
      )
    `).run();

		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS account (
        account_id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        status INTEGER DEFAULT 0 NOT NULL,
        latest_email_time DATETIME,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER NOT NULL,
        is_del INTEGER DEFAULT 0 NOT NULL
      )
    `).run();

		await c.env.db.prepare(`
      CREATE TABLE IF NOT EXISTS setting (
        register INTEGER NOT NULL,
        receive INTEGER NOT NULL,
        add_email INTEGER NOT NULL,
        many_email INTEGER NOT NULL,
        title TEXT NOT NULL,
        auto_refresh_time INTEGER NOT NULL,
        register_verify INTEGER NOT NULL,
        add_email_verify INTEGER NOT NULL
      )
    `).run();

		await c.env.db.prepare(`
      INSERT INTO setting (
        register, receive, add_email, many_email, title, auto_refresh_time, register_verify, add_email_verify
      )
      SELECT 0, 0, 0, 1, 'Cloud Mail', 0, 1, 1
      WHERE NOT EXISTS (SELECT 1 FROM setting)
    `).run();
	},

	async receiveEmailToRecipient(c) {

		const receiveEmailColumn = await c.env.db.prepare(`SELECT * FROM pragma_table_info('email') WHERE name = 'receive_email' limit 1`).first();

		if (!receiveEmailColumn) {
			return
		}

		const queryList = []
		const {results} = await c.env.db.prepare('SELECT receive_email,email_id FROM email').all();
		results.forEach(emailRow => {
			const recipient = {}
			recipient.address = emailRow.receive_email
			recipient.name = ''
			const recipientStr = JSON.stringify([recipient]);
			const sql = c.env.db.prepare('UPDATE email SET recipient = ? WHERE email_id = ?').bind(recipientStr,emailRow.email_id);
			queryList.push(sql)
		})

		queryList.push(c.env.db.prepare("ALTER TABLE email DROP COLUMN receive_email"));

		await c.env.db.batch(queryList);
	},


	async initAccountName(c) {

		const nameColumn = await c.env.db.prepare(`SELECT * FROM pragma_table_info('account') WHERE name = 'name' limit 1`).first();

		if (nameColumn) {
			return
		}

		const queryList = []

		queryList.push(c.env.db.prepare(`ALTER TABLE account ADD COLUMN name TEXT NOT NULL DEFAULT ''`));

		const {results} = await c.env.db.prepare(`SELECT account_id, email FROM account`).all();

		results.forEach(accountRow => {
			const name = emailUtils.getName(accountRow.email);
			const sql = c.env.db.prepare('UPDATE account SET name = ? WHERE account_id = ?').bind(name,accountRow.account_id);
			queryList.push(sql)
		})

		await c.env.db.batch(queryList);
	},

	async addShareWhitelistColumn(c) {

		const shareWhitelistColumn = await c.env.db.prepare(`SELECT * FROM pragma_table_info('setting') WHERE name = 'share_whitelist' limit 1`).first();

		if (shareWhitelistColumn) {
			return
		}

		await c.env.db.prepare("ALTER TABLE setting ADD COLUMN share_whitelist TEXT NOT NULL DEFAULT ''").run();

	},

	async createShareTable(c) {

		await c.env.db.prepare(`
			CREATE TABLE IF NOT EXISTS share (
				share_id INTEGER PRIMARY KEY AUTOINCREMENT,
				share_token TEXT NOT NULL UNIQUE,
				target_email TEXT NOT NULL,
				share_name TEXT NOT NULL,
				share_domain TEXT,
				keyword_filter TEXT DEFAULT '',
				expire_time TEXT NOT NULL,
				create_time TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
				user_id INTEGER NOT NULL,
				is_active INTEGER DEFAULT 1 NOT NULL,
				rate_limit_per_second INTEGER DEFAULT 5 NOT NULL,
				rate_limit_per_minute INTEGER DEFAULT 60 NOT NULL
			)
		`).run();

	},

	async createShareAccessLogTable(c) {

		await c.env.db.prepare(`
			CREATE TABLE IF NOT EXISTS share_access_log (
				log_id INTEGER PRIMARY KEY AUTOINCREMENT,
				share_id INTEGER,
				share_token TEXT NOT NULL,
				access_ip TEXT NOT NULL,
				user_agent TEXT DEFAULT '',
				access_email TEXT NOT NULL,
				extracted_codes TEXT DEFAULT '[]',
				access_result TEXT NOT NULL,
				error_message TEXT DEFAULT '',
				access_time TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
				response_time INTEGER DEFAULT 0,
				email_count INTEGER DEFAULT 0
			)
		`).run();

	}
};
export default init;
