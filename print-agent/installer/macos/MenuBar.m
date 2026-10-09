#import <Cocoa/Cocoa.h>
#import <ServiceManagement/ServiceManagement.h>
#import <UserNotifications/UserNotifications.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, UNUserNotificationCenterDelegate>
@property(nonatomic, strong) NSStatusItem *statusItem;
@property(nonatomic, strong) NSMenuItem *statusMenuItem;
@property(nonatomic, strong) NSMenuItem *pairingMenuItem;
@property(nonatomic, strong) NSMenuItem *printersMenuItem;
@property(nonatomic, strong) NSMenuItem *queueMenuItem;
@property(nonatomic, strong) NSMenuItem *updateMenuItem;
@property(nonatomic, strong) NSMenuItem *launchAtLoginMenuItem;
@property(nonatomic, strong) NSTask *agentTask;
@property(nonatomic, strong) NSTimer *healthTimer;
@property(nonatomic) BOOL wasHealthy;
@property(nonatomic) NSInteger failedJobCount;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    if ([NSRunningApplication runningApplicationsWithBundleIdentifier:NSBundle.mainBundle.bundleIdentifier].count > 1) {
        [NSApp terminate:nil];
        return;
    }
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    UNUserNotificationCenter *notificationCenter = UNUserNotificationCenter.currentNotificationCenter;
    notificationCenter.delegate = self;
    [notificationCenter requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound) completionHandler:^(BOOL granted, NSError *error) {}];
    self.statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSSquareStatusItemLength];
    NSString *iconPath = [[NSBundle mainBundle] pathForResource:@"AppIcon" ofType:@"icns"];
    NSImage *icon = [[NSImage alloc] initWithContentsOfFile:iconPath];
    icon.size = NSMakeSize(18, 18);
    self.statusItem.button.image = icon;
    self.statusItem.button.toolTip = @"Zettaz Print Agent";

    NSMenu *menu = [[NSMenu alloc] init];
    NSMenuItem *title = [[NSMenuItem alloc] initWithTitle:@"Zettaz Print Agent" action:nil keyEquivalent:@""];
    title.enabled = NO;
    [menu addItem:title];
    self.statusMenuItem = [self disabledItem:@"Starting…"];
    self.pairingMenuItem = [self disabledItem:@"Pairing: Checking…"];
    self.printersMenuItem = [self disabledItem:@"Printers: Checking…"];
    self.queueMenuItem = [self disabledItem:@"Queue: Checking…"];
    [menu addItem:self.statusMenuItem];
    [menu addItem:self.pairingMenuItem];
    [menu addItem:self.printersMenuItem];
    [menu addItem:self.queueMenuItem];
    [menu addItem:[NSMenuItem separatorItem]];
    [menu addItem:[self actionItem:@"Open Print Agent Page" selector:@selector(openPrintAgentPage:)]];
    [menu addItem:[self actionItem:@"View Logs" selector:@selector(viewLogs:)]];
    [menu addItem:[self actionItem:@"Export Diagnostics…" selector:@selector(exportDiagnostics:)]];
    self.updateMenuItem = [self actionItem:@"Check for Updates" selector:@selector(checkForUpdates:)];
    [menu addItem:self.updateMenuItem];
    [menu addItem:[NSMenuItem separatorItem]];
    self.launchAtLoginMenuItem = [self actionItem:@"Launch at Login" selector:@selector(toggleLaunchAtLogin:)];
    [menu addItem:self.launchAtLoginMenuItem];
    [menu addItem:[self actionItem:@"Restart Agent" selector:@selector(restartAgent:)]];
    [menu addItem:[NSMenuItem separatorItem]];
    NSMenuItem *quit = [[NSMenuItem alloc] initWithTitle:@"Quit Zettaz Print Agent" action:@selector(quitAgent:) keyEquivalent:@"q"];
    quit.target = self;
    [menu addItem:quit];
    self.statusItem.menu = menu;

    [self configureLaunchAtLogin];
    [self startAgent];
    self.healthTimer = [NSTimer scheduledTimerWithTimeInterval:3.0 target:self selector:@selector(checkHealth:) userInfo:nil repeats:YES];
    [self checkHealth:nil];
    [self checkForUpdates:nil];
}

- (NSMenuItem *)disabledItem:(NSString *)title {
    NSMenuItem *item = [[NSMenuItem alloc] initWithTitle:title action:nil keyEquivalent:@""];
    item.enabled = NO;
    return item;
}

- (NSMenuItem *)actionItem:(NSString *)title selector:(SEL)selector {
    NSMenuItem *item = [[NSMenuItem alloc] initWithTitle:title action:selector keyEquivalent:@""];
    item.target = self;
    return item;
}

- (void)configureLaunchAtLogin {
    if (@available(macOS 13.0, *)) {
        SMAppService *service = SMAppService.mainAppService;
        NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
        if (![defaults boolForKey:@"launchAtLoginConfigured"]) {
            NSError *error = nil;
            [service registerAndReturnError:&error];
            [defaults setBool:YES forKey:@"launchAtLoginConfigured"];
        }
        self.launchAtLoginMenuItem.state = service.status == SMAppServiceStatusEnabled ? NSControlStateValueOn : NSControlStateValueOff;
    } else {
        self.launchAtLoginMenuItem.enabled = NO;
        self.launchAtLoginMenuItem.title = @"Launch at Login requires macOS 13";
    }
}

- (void)toggleLaunchAtLogin:(id)sender {
    if (@available(macOS 13.0, *)) {
        SMAppService *service = SMAppService.mainAppService;
        NSError *error = nil;
        if (service.status == SMAppServiceStatusEnabled) [service unregisterAndReturnError:&error];
        else [service registerAndReturnError:&error];
        if (error) {
            [self showAlert:@"Launch at Login" message:error.localizedDescription];
            return;
        }
        self.launchAtLoginMenuItem.state = service.status == SMAppServiceStatusEnabled ? NSControlStateValueOn : NSControlStateValueOff;
    }
}

- (void)startAgent {
    if (self.agentTask.running) return;
    NSString *executable = [[NSBundle mainBundle] pathForAuxiliaryExecutable:@"zettaz-print-agent-service"];
    if (!executable) {
        self.statusMenuItem.title = @"Agent executable missing";
        return;
    }
    self.agentTask = [[NSTask alloc] init];
    self.agentTask.executableURL = [NSURL fileURLWithPath:executable];
    self.agentTask.standardOutput = [NSFileHandle fileHandleWithNullDevice];
    self.agentTask.standardError = [NSFileHandle fileHandleWithNullDevice];
    NSMutableDictionary *env = [NSMutableDictionary dictionaryWithDictionary:[[NSProcessInfo processInfo] environment]];
    [env setObject:NSTemporaryDirectory() forKey:@"TMPDIR"];
    self.agentTask.environment = env;
    NSError *error = nil;
    [self.agentTask launchAndReturnError:&error];
    if (error) self.statusMenuItem.title = @"Agent failed to start";
}

- (void)checkHealth:(NSTimer *)timer {
    NSURL *url = [NSURL URLWithString:@"http://127.0.0.1:9419/v1/health"];
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        NSDictionary *payload = data && !error ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (payload) {
                NSString *version = payload[@"version"];
                self.statusMenuItem.title = version.length ? [NSString stringWithFormat:@"Running · %@", version] : @"Running";
                if ([payload[@"paired"] boolValue]) {
                    self.pairingMenuItem.title = @"Pairing: Connected";
                } else {
                    // Show the code right in the menu — the agent only returns
                    // it to local/no-origin clients now, which is exactly what
                    // this menu bar (NSURLSession, no Origin header) is.
                    NSString *code = payload[@"pairingCode"];
                    self.pairingMenuItem.title = code.length ? [NSString stringWithFormat:@"Pairing code: %@", code] : @"Pairing: Ready";
                }
                NSNumber *printerCount = payload[@"printerCount"];
                self.printersMenuItem.title = printerCount ? [NSString stringWithFormat:@"Printers: %@", printerCount] : @"Printers: Open page to view";
                NSDictionary *queue = payload[@"queue"];
                self.queueMenuItem.title = queue ? [NSString stringWithFormat:@"Queue: %@ queued · %@ failed", queue[@"queued"] ?: @0, queue[@"failed"] ?: @0] : @"Queue: Open page to view";
                NSInteger failed = [queue[@"failed"] integerValue];
                if (self.wasHealthy && failed > self.failedJobCount) [self deliverNotification:@"Print job failed" message:@"Open the Print Agent page to review and retry the job."];
                self.failedJobCount = failed;
                self.wasHealthy = YES;
            } else {
                self.statusMenuItem.title = @"Agent unavailable";
                self.pairingMenuItem.title = @"Pairing: Unavailable";
                self.printersMenuItem.title = @"Printers: Unavailable";
                self.queueMenuItem.title = @"Queue: Unavailable";
                if (self.wasHealthy) [self deliverNotification:@"Print Agent unavailable" message:@"The local print service stopped responding."];
                self.wasHealthy = NO;
                if (!self.agentTask.running) [self startAgent];
            }
        });
    }];
    [task resume];
}

- (void)openPrintAgentPage:(id)sender {
    [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:@"https://cloud.zettaz.com/print-agent"]];
}

- (void)viewLogs:(id)sender {
    NSString *directory = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Application Support/Zettaz/PrintAgent"];
    [[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:nil];
    [[NSWorkspace sharedWorkspace] openURL:[NSURL fileURLWithPath:directory isDirectory:YES]];
}

- (void)exportDiagnostics:(id)sender {
    NSURL *url = [NSURL URLWithString:@"http://127.0.0.1:9419/v1/health"];
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (!data || error) {
            dispatch_async(dispatch_get_main_queue(), ^{ [self showAlert:@"Export Diagnostics" message:@"The Print Agent is unavailable."]; });
            return;
        }
        NSDictionary *health = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] ?: @{};
        NSDictionary *diagnostics = @{
            @"generatedAt": [[NSISO8601DateFormatter new] stringFromDate:[NSDate date]],
            @"health": health,
            @"macOSVersion": NSProcessInfo.processInfo.operatingSystemVersionString,
            @"applicationPath": NSBundle.mainBundle.bundlePath
        };
        NSData *output = [NSJSONSerialization dataWithJSONObject:diagnostics options:NSJSONWritingPrettyPrinted error:nil];
        dispatch_async(dispatch_get_main_queue(), ^{
            NSSavePanel *panel = NSSavePanel.savePanel;
            panel.nameFieldStringValue = @"zettaz-print-agent-diagnostics.json";
            if ([panel runModal] == NSModalResponseOK) [output writeToURL:panel.URL atomically:YES];
        });
    }];
    [task resume];
}

- (void)checkForUpdates:(id)sender {
    NSURL *url = [NSURL URLWithString:@"https://cloud.zettaz.com/downloads/manifest.json"];
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        NSDictionary *manifest = data && !error ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
        NSString *latest = manifest[@"macos"][@"version"];
        NSString *current = NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"];
        BOOL available = latest.length && [latest compare:current options:NSNumericSearch] == NSOrderedDescending;
        dispatch_async(dispatch_get_main_queue(), ^{
            self.updateMenuItem.title = available ? [NSString stringWithFormat:@"Update Available · %@", latest] : @"Check for Updates";
            if (sender && !available) [self showAlert:@"Software Update" message:manifest ? @"Zettaz Print Agent is up to date." : @"Could not check for updates."];
            if (sender && available) [self openPrintAgentPage:nil];
        });
    }];
    [task resume];
}

- (void)restartAgent:(id)sender {
    if (self.agentTask.running) [self.agentTask terminate];
    self.agentTask = nil;
    self.statusMenuItem.title = @"Restarting…";
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.75 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{ [self startAgent]; });
}

- (void)deliverNotification:(NSString *)title message:(NSString *)message {
    UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
    content.title = title;
    content.body = message;
    content.sound = UNNotificationSound.defaultSound;
    UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:NSUUID.UUID.UUIDString content:content trigger:nil];
    [UNUserNotificationCenter.currentNotificationCenter addNotificationRequest:request withCompletionHandler:nil];
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center willPresentNotification:(UNNotification *)notification withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler {
    completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound);
}

- (void)showAlert:(NSString *)title message:(NSString *)message {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = title;
    alert.informativeText = message;
    [alert runModal];
}

- (void)quitAgent:(id)sender {
    [self.healthTimer invalidate];
    if (self.agentTask.running) [self.agentTask terminate];
    [NSApp terminate:nil];
}

- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender {
    if (self.agentTask.running) [self.agentTask terminate];
    return NSTerminateNow;
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        application.delegate = delegate;
        [application run];
    }
    return 0;
}
