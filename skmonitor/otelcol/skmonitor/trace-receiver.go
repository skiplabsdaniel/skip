package skmonitor

import (
	"context"
	"time"
	"go.opentelemetry.io/collector/component"
	"go.opentelemetry.io/collector/consumer"
	"go.uber.org/zap"
)

type skmonitorReceiver struct {
	host         component.Host
	cancel       context.CancelFunc
	logger       *zap.Logger
	nextConsumer consumer.Traces
	config       *Config
}

func (skmonitorRcvr *skmonitorReceiver) Start(ctx context.Context, host component.Host) error {
	skmonitorRcvr.host = host
	ctx = context.Background()
	ctx, skmonitorRcvr.cancel = context.WithCancel(ctx)

	interval := time.Minute
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
				case <-ticker.C:
					skmonitorRcvr.logger.Info("I should start processing traces now!")
				case <-ctx.Done():
					return
			}
		}
	}()

	return nil
}

func (skmonitorRcvr *skmonitorReceiver) Shutdown(ctx context.Context) error {
	skmonitorRcvr.cancel()
	return nil
}